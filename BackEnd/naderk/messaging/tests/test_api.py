"""The messaging REST endpoints: who sees which conversations and what they can do in them."""
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from naderk.core.models import User
from naderk.messaging.models import (
    Conversation, ConversationPriority, ConversationStatus, InternalNote, MessageRead,
)
from naderk.messaging.services import send_message
from naderk.messaging.tests import factories
from naderk.notifications.models import Notification
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

LIST = '/api/v1/messages/conversations/'


def detail(conv):
    return f'{LIST}{conv.id}/'


@pytest.fixture
def agent():
    return make_user('agent@naderk.test', role=User.Role.AGENT)


def ids(response):
    return {row['id'] for row in response.json()['data']['results']}


# ── Listing ──────────────────────────────────────────────────────────────────

def test_listing_requires_sign_in(api_client):
    assert api_client.get(LIST).status_code == 401


def test_patient_sees_only_their_own_conversations(patient, other_patient):
    mine, theirs = factories.conversation(patient), factories.conversation(other_patient)

    assert ids(client_for(patient).get(LIST)) == {str(mine.id)}
    assert str(theirs.id) not in ids(client_for(patient).get(LIST))


def test_agent_sees_the_open_queue_but_not_closed_threads(patient, other_patient, agent):
    open_conv, closed = factories.conversation(patient), factories.conversation(other_patient)
    Conversation.objects.filter(pk=closed.pk).update(status=ConversationStatus.CLOSED)

    assert ids(client_for(agent).get(LIST)) == {str(open_conv.id)}


def test_doctor_sees_only_conversations_assigned_to_them_most_urgent_first(patient, other_patient, doctor):
    routine = factories.conversation(patient, doctor=doctor)
    urgent = factories.conversation(other_patient, message='Sudden vision loss', doctor=doctor)
    factories.conversation(patient)       # not theirs

    rows = client_for(doctor).get(LIST).json()['data']['results']

    assert [row['id'] for row in rows] == [str(urgent.id), str(routine.id)]


def test_archived_conversations_are_hidden(patient):
    conv = factories.conversation(patient)
    Conversation.objects.filter(pk=conv.pk).update(is_archived=True)

    assert ids(client_for(patient).get(LIST)) == set()


def test_unread_count_and_last_message_are_reported(patient, agent):
    conv = factories.conversation(patient)
    send_message(conversation=conv, sender=agent, content='How can we help?')

    row = client_for(patient).get(LIST).json()['data']['results'][0]

    assert row['unread_count'] == 1
    assert row['last_message']['content'] == 'How can we help?'


# ── Starting a conversation ──────────────────────────────────────────────────

def start(user, **body):
    body = {'category': 'APPOINTMENT', 'message': 'I need to move my visit.', **body}
    return client_for(user).post(LIST, body, format='json')


def test_patient_starts_a_conversation_that_is_routed_to_an_agent(patient, agent):
    res = start(patient, subject='Reschedule')

    assert res.status_code == 201, res.content
    data = res.json()['data']
    assert data['status'] == ConversationStatus.WAITING_FOR_AGENT
    assert data['assigned_agent']['id'] == str(agent.id)
    assert data['department'] == 'APPOINTMENTS'
    assert Notification.objects.filter(user=agent).exists()


def test_emergency_wording_is_triaged_as_urgent(patient):
    res = start(patient, category='OTHER', message='I have sudden pain in my left eye')

    assert res.json()['data']['priority'] == ConversationPriority.URGENT


@pytest.mark.parametrize('role', [User.Role.DOCTOR, User.Role.AGENT, User.Role.ADMIN])
def test_only_patients_start_conversations(role):
    assert start(make_user('staff@naderk.test', role=role)).status_code == 403


@pytest.mark.parametrize('body, field', [
    ({'category': 'NOT_A_CATEGORY'}, 'category'),
    ({'message': ''}, 'message'),
    ({'attachment_url': 'not a url'}, 'attachment_url'),
])
def test_starting_a_conversation_validates_input(patient, body, field):
    res = start(patient, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not Conversation.objects.exists()


# ── Reading a conversation ───────────────────────────────────────────────────

def test_patient_reads_their_conversation_and_it_is_marked_read(patient, agent):
    conv = factories.conversation(patient)
    reply = send_message(conversation=conv, sender=agent, content='How can we help?')

    res = client_for(patient).get(detail(conv))

    assert res.status_code == 200, res.content
    assert [m['content'] for m in res.json()['data']['messages']] == [
        'Hello, I have a question.', 'How can we help?',
    ]
    assert MessageRead.objects.filter(message=reply, user=patient).exists()
    assert client_for(patient).get(LIST).json()['data']['results'][0]['unread_count'] == 0


def test_another_patient_cannot_read_it(patient, other_patient):
    conv = factories.conversation(patient)

    assert client_for(other_patient).get(detail(conv)).status_code == 403


def test_unknown_conversation_is_404(patient):
    assert client_for(patient).get(f'{LIST}00000000-0000-0000-0000-000000000000/').status_code == 404


def test_internal_notes_are_never_sent_to_the_patient(patient, agent):
    conv = factories.conversation(patient)
    InternalNote.objects.create(conversation=conv, author=agent, content='Patient sounds anxious')

    as_patient = client_for(patient).get(detail(conv)).json()['data']
    as_agent = client_for(agent).get(detail(conv)).json()['data']

    assert as_patient['internal_notes'] == []
    assert [n['content'] for n in as_agent['internal_notes']] == ['Patient sounds anxious']


@pytest.mark.xfail(strict=True, reason=(
    'MEDICAL_AGENT and SUPER_ADMIN get every conversation in the list and may assign them, but the '
    'detail, message and notes endpoints only treat AGENT, DOCTOR and ADMIN as staff.'
))
@pytest.mark.parametrize('role', [User.Role.MEDICAL_AGENT, User.Role.SUPER_ADMIN])
def test_every_triage_role_can_open_a_conversation_it_can_list(patient, role):
    conv = factories.conversation(patient)
    staff = make_user('triage@naderk.test', role=role)
    assert str(conv.id) in ids(client_for(staff).get(LIST))

    assert client_for(staff).get(detail(conv)).status_code == 200


# ── Sending messages ─────────────────────────────────────────────────────────

def say(user, conv, content='Thanks', **extra):
    return client_for(user).post(f'{detail(conv)}message/', {'content': content, **extra}, format='json')


def test_patient_and_agent_exchange_messages(patient, agent):
    conv = factories.conversation(patient)

    assert say(agent, conv, 'How can we help?').status_code == 201
    assert say(patient, conv, 'I need a new time').status_code == 201

    conv.refresh_from_db()
    assert conv.status == ConversationStatus.AGENT_ACTIVE
    assert conv.first_response_at is not None
    assert conv.messages.count() == 3


def test_outsider_cannot_post_into_a_conversation(patient, other_patient):
    conv = factories.conversation(patient)

    assert say(other_patient, conv).status_code == 403
    assert conv.messages.count() == 1


def test_empty_message_is_rejected(patient):
    conv = factories.conversation(patient)

    assert say(patient, conv, '').status_code == 400


def test_patient_message_reopens_a_closed_conversation(patient, agent):
    conv = factories.conversation(patient)
    Conversation.objects.filter(pk=conv.pk).update(status=ConversationStatus.CLOSED)

    say(patient, conv, 'One more thing')

    conv.refresh_from_db()
    assert conv.status == ConversationStatus.WAITING_FOR_AGENT
    assert conv.activities.filter(action='REOPENED').exists()


def test_the_other_participants_are_notified(patient, agent):
    conv = factories.conversation(patient)
    Notification.objects.all().delete()

    say(agent, conv, 'How can we help?')

    assert list(Notification.objects.values_list('user__email', 'title')) == [
        (patient.email, 'New Message from Care Team'),
    ]


@pytest.mark.parametrize('url, kind', [
    ('https://files.naderk.test/scan.PNG', 'IMAGE'),
    ('https://files.naderk.test/report.pdf', 'FILE'),
])
def test_attachment_sets_the_message_type(patient, url, kind):
    conv = factories.conversation(patient)

    say(patient, conv, 'See attached', attachment_url=url)

    message = conv.messages.order_by('-created_at').first()
    assert message.message_type == kind
    assert message.attachments.get().file_url == url


# ── Internal notes ───────────────────────────────────────────────────────────

def notes(conv):
    return f'{detail(conv)}notes/'


def test_staff_add_and_read_internal_notes(patient, agent, doctor):
    conv = factories.conversation(patient)

    res = client_for(agent).post(notes(conv), {'content': 'Called the patient'}, format='json')

    assert res.status_code == 201, res.content
    listed = client_for(doctor).get(notes(conv)).json()['data']['results']
    assert [n['content'] for n in listed] == ['Called the patient']
    assert conv.activities.filter(action='NOTE_ADDED').exists()


def test_patients_can_neither_read_nor_write_internal_notes(patient):
    conv = factories.conversation(patient)

    assert client_for(patient).get(notes(conv)).status_code == 403
    assert client_for(patient).post(notes(conv), {'content': 'x'}, format='json').status_code == 403
    assert not InternalNote.objects.exists()


def test_blank_note_is_rejected(patient, agent):
    conv = factories.conversation(patient)

    assert client_for(agent).post(notes(conv), {'content': ''}, format='json').status_code == 400


# ── Assigning ────────────────────────────────────────────────────────────────

def assign(user, conv, **body):
    return client_for(user).post(f'{detail(conv)}assign/', body, format='json')


def test_agent_escalates_to_a_doctor(patient, agent, doctor):
    conv = factories.conversation(patient)

    res = assign(agent, conv, assigned_doctor_id=str(doctor.id), reason='Needs a clinician')

    assert res.status_code == 200, res.content
    conv.refresh_from_db()
    assert conv.assigned_doctor == doctor
    assert conv.status == ConversationStatus.WAITING_FOR_DOCTOR
    assert str(conv.id) in ids(client_for(doctor).get(LIST))


def test_agent_changes_priority_department_and_closes(patient, agent):
    conv = factories.conversation(patient)

    res = assign(agent, conv, priority='HIGH', department='BILLING', status='CLOSED')

    assert res.status_code == 200, res.content
    conv.refresh_from_db()
    assert (conv.priority, conv.department, conv.status) == ('HIGH', 'BILLING', 'CLOSED')
    assert conv.resolved_at is not None
    assert set(conv.activities.values_list('action', flat=True)) >= {
        'PRIORITY_CHANGED', 'DEPARTMENT_CHANGED', 'STATUS_CHANGED',
    }


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.DOCTOR])
def test_only_triage_staff_assign(patient, role):
    conv = factories.conversation(patient)
    user = patient if role == User.Role.PATIENT else make_user('doc2@naderk.test', role=role)

    assert assign(user, conv, priority='HIGH').status_code == 403


def test_assigning_to_someone_who_is_not_a_doctor_is_refused(patient, other_patient, agent):
    conv = factories.conversation(patient)

    assert assign(agent, conv, assigned_doctor_id=str(other_patient.id)).status_code == 400
    conv.refresh_from_db()
    assert conv.assigned_doctor is None


def test_assign_validates_choices(patient, agent):
    conv = factories.conversation(patient)

    res = assign(agent, conv, priority='SUPER_URGENT')

    assert res.status_code == 400
    assert 'priority' in res.json()['errors']


# ── Attachments ──────────────────────────────────────────────────────────────

UPLOAD = '/api/v1/messages/upload/'


def upload(user, name='scan.png', size=10):
    file = SimpleUploadedFile(name, b'x' * size)
    return client_for(user).post(UPLOAD, {'file': file}, format='multipart')


def test_upload_returns_the_stored_url(patient):
    with patch('naderk.messaging.apis.upload_attachment', return_value='https://files.naderk.test/scan.png'):
        res = upload(patient)

    assert res.status_code == 200, res.content
    assert res.json()['data']['url'] == 'https://files.naderk.test/scan.png'


@pytest.mark.parametrize('name', ['malware.exe', 'page.html', 'noextension'])
def test_upload_refuses_other_file_types(patient, name):
    with patch('naderk.messaging.apis.upload_attachment') as store:
        assert upload(patient, name).status_code == 400
    store.assert_not_called()


def test_upload_refuses_files_over_five_megabytes(patient):
    with patch('naderk.messaging.apis.upload_attachment') as store:
        assert upload(patient, size=5 * 1024 * 1024 + 1).status_code == 400
    store.assert_not_called()


def test_upload_requires_a_file_and_sign_in(patient, api_client):
    assert client_for(patient).post(UPLOAD, {}, format='multipart').status_code == 400
    assert api_client.post(UPLOAD, {}, format='multipart').status_code == 401
