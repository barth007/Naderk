"""Who may read, join and write to a telehealth session."""
import pytest
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.core.models import User
from naderk.telehealth.consumers import TelehealthConsumer
from naderk.telehealth.models import TelehealthSession
from naderk.telehealth.services.generate_token import generate_livekit_token
from tests.helpers import client_for, make_user

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures('channels_db')]


@pytest.fixture
def session(patient, doctor):
    """A confirmed telehealth appointment; the post_save signal creates its session."""
    appt = factories.appointment(
        patient, factories.service(), doctor, paid=True,
        status=Appointment.Status.CONFIRMED, kind=Appointment.AppointmentType.TELEHEALTH,
    )
    return TelehealthSession.objects.get(appointment=appt)


def complete(user, session, **body):
    return client_for(user).post(f'/api/v1/telehealth/session/{session.id}/complete/', body, format='json')


# ── Session notes ────────────────────────────────────────────────────────────

def test_patient_cannot_overwrite_session_notes(patient, session):
    TelehealthSession.objects.filter(pk=session.pk).update(session_notes='Doctor wrote this')

    res = complete(patient, session, session_notes='Patient wrote this')

    assert res.status_code == 403, res.content
    session.refresh_from_db()
    assert session.session_notes == 'Doctor wrote this'
    assert session.status != TelehealthSession.Status.COMPLETED


def test_doctor_completes_the_session_with_notes(doctor, session):
    res = complete(doctor, session, session_notes='All clear', diagnosis='Mild myopia')

    assert res.status_code == 200, res.content
    session.refresh_from_db()
    assert session.session_notes == 'All clear'
    assert session.status == TelehealthSession.Status.COMPLETED


# ── Joining the call ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('role', [User.Role.ADMIN, User.Role.AGENT, User.Role.MEDICAL_AGENT])
def test_staff_are_not_issued_a_call_token(session, role):
    staff = make_user('staff@naderk.test', role=role)

    with pytest.raises(PermissionError):
        generate_livekit_token(session=session, user=staff)


def test_patient_and_doctor_are_issued_a_call_token(patient, doctor, session):
    assert generate_livekit_token(session=session, user=patient)
    assert generate_livekit_token(session=session, user=doctor)


# ── Live events over the WebSocket ───────────────────────────────────────────

def subscribe(user, session_id):
    """Connect as `user`, ask for the session's events, return the server's reply."""
    async def run():
        socket = WebsocketCommunicator(TelehealthConsumer.as_asgi(), '/ws/telehealth/')
        socket.scope['user'] = user
        connected, _ = await socket.connect()
        assert connected
        await socket.send_json_to({'action': 'subscribe', 'session_id': str(session_id)})
        reply = await socket.receive_json_from()
        await socket.disconnect()
        return reply

    return async_to_sync(run)()


def test_participants_can_subscribe(patient, doctor, session):
    assert subscribe(patient, session.id)['action'] == 'subscribed'
    assert subscribe(doctor, session.id)['action'] == 'subscribed'


def test_admin_can_subscribe(admin_user, session):
    assert subscribe(admin_user, session.id)['action'] == 'subscribed'


def test_unrelated_user_cannot_subscribe(other_patient, session):
    reply = subscribe(other_patient, session.id)

    assert reply['action'] == 'error'
    assert 'user' not in reply


@pytest.mark.parametrize('session_id', ['not-a-uuid', '00000000-0000-0000-0000-000000000000'])
def test_unknown_session_cannot_be_subscribed_to(patient, session_id):
    assert subscribe(patient, session_id)['action'] == 'error'
