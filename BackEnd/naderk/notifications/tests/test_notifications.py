"""In-app notifications: listing, marking read, and the live push."""
import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from naderk.notifications.models import Notification
from naderk.notifications.services import create_notification
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

LIST = '/api/v1/notifications/'


def notify(user, title='Hello', message='Something happened'):
    return create_notification(user=user, title=title, message=message)


def test_listing_requires_sign_in(api_client):
    assert api_client.get(LIST).status_code == 401


def test_user_sees_only_their_own_notifications_newest_first(patient, other_patient):
    notify(patient, 'First')
    notify(patient, 'Second')
    notify(other_patient, 'Not yours')

    data = client_for(patient).get(LIST).json()['data']

    assert [n['title'] for n in data['results']] == ['Second', 'First']
    assert data['unread_count'] == 2


def test_marking_one_as_read(patient):
    first, second = notify(patient, 'First'), notify(patient, 'Second')

    res = client_for(patient).post(f'{LIST}{first.id}/read/')

    assert res.status_code == 200, res.content
    assert res.json()['data']['is_read'] is True
    assert client_for(patient).get(LIST).json()['data']['unread_count'] == 1
    second.refresh_from_db()
    assert second.is_read is False


def test_cannot_mark_someone_elses_notification(patient, other_patient):
    theirs = notify(other_patient)

    assert client_for(patient).post(f'{LIST}{theirs.id}/read/').status_code == 404
    theirs.refresh_from_db()
    assert theirs.is_read is False


def test_marking_all_as_read_leaves_other_users_alone(patient, other_patient):
    notify(patient), notify(patient), notify(other_patient)

    res = client_for(patient).post(LIST)

    assert res.status_code == 200
    assert 'Marked 2' in res.json()['message']
    assert not Notification.objects.filter(user=patient, is_read=False).exists()
    assert Notification.objects.filter(user=other_patient, is_read=False).count() == 1


def test_a_new_notification_is_pushed_to_the_users_socket_group(patient):
    layer = get_channel_layer()
    channel = async_to_sync(layer.new_channel)()
    async_to_sync(layer.group_add)(f'user_{patient.id}', channel)

    notification = notify(patient, 'Session starting')
    event = async_to_sync(layer.receive)(channel)

    assert event['type'] == 'notification_received'
    assert event['notification']['id'] == str(notification.id)
    assert event['notification']['title'] == 'Session starting'
    assert event['notification']['conversation_id'] is None
