"""The messaging WebSocket: token authentication and live delivery."""
import pytest
from asgiref.sync import async_to_sync, sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import RefreshToken

from naderk.core.models import User
from naderk.messaging.middleware import JWTAuthMiddleware, get_user_from_token
from naderk.messaging.models import MessageRead
from naderk.messaging.routing import websocket_urlpatterns
from naderk.messaging.services import create_internal_note, send_message
from naderk.messaging.tests import factories
from tests.helpers import make_user

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures('channels_db')]

APP = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


def access_token(user):
    return str(RefreshToken.for_user(user).access_token)


def session(user, steps, token=None):
    """
    Open a socket as `user`, run `steps(send, receive)` and return its result.
    `receive()` returns the next frame, or None if nothing arrives.
    """
    # Issued before entering the event loop: creating a token writes to the database.
    query = f'?token={token if token is not None else access_token(user)}'

    async def run():
        socket = WebsocketCommunicator(APP, f'/ws/messaging/{query}')
        connected, _ = await socket.connect()
        assert connected

        async def receive():
            return None if await socket.receive_nothing(timeout=0.05) else await socket.receive_json_from()

        async def drain():
            while await receive() is not None:
                pass

        try:
            return await steps(socket.send_json_to, receive, drain)
        finally:
            await socket.disconnect()

    return async_to_sync(run)()


def can_connect(query):
    async def run():
        socket = WebsocketCommunicator(APP, f'/ws/messaging/{query}')
        connected, _ = await socket.connect()
        if connected:
            await socket.disconnect()
        return connected

    return async_to_sync(run)()


# ── Authentication ───────────────────────────────────────────────────────────

def test_token_resolves_to_its_user(patient):
    assert async_to_sync(get_user_from_token)(access_token(patient)) == patient


@pytest.mark.parametrize('token', ['', 'garbage', 'a.b.c'])
def test_bad_token_resolves_to_anonymous(token):
    assert isinstance(async_to_sync(get_user_from_token)(token), AnonymousUser)


def test_refresh_token_is_not_accepted_for_the_socket(patient):
    refresh = str(RefreshToken.for_user(patient))

    assert isinstance(async_to_sync(get_user_from_token)(refresh), AnonymousUser)


def test_socket_accepts_a_valid_token(patient):
    assert can_connect(f'?token={access_token(patient)}') is True


@pytest.mark.parametrize('query', ['', '?token=garbage', '?other=1'])
def test_socket_refuses_missing_or_invalid_tokens(query):
    assert can_connect(query) is False


def test_deactivated_user_is_refused(patient):
    token = access_token(patient)
    patient.is_active = False
    patient.save()

    assert can_connect(f'?token={token}') is False


# ── Live delivery ────────────────────────────────────────────────────────────

def test_ping_is_answered(patient):
    async def steps(send, receive, drain):
        await send({'action': 'ping'})
        return await receive()

    assert session(patient, steps) == {'action': 'pong'}


def test_subscriber_receives_new_messages(patient):
    conv = factories.conversation(patient)
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)

    async def steps(send, receive, drain):
        await send({'action': 'subscribe', 'conversation_id': str(conv.id)})
        assert (await receive())['action'] == 'subscribed'
        await sync_to_async(send_message)(conversation=conv, sender=agent, content='How can we help?')
        frames = []
        while (frame := await receive()) is not None:
            frames.append(frame)
        return frames

    frames = session(patient, steps)

    messages = [f for f in frames if f['action'] == 'message']
    assert messages and messages[0]['message']['content'] == 'How can we help?'


def test_internal_notes_reach_staff_sockets_but_never_a_patients_own(patient):
    conv = factories.conversation(patient)
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)

    def frames_for(user):
        async def steps(send, receive, drain):
            await send({'action': 'subscribe', 'conversation_id': str(conv.id)})
            await drain()
            await sync_to_async(create_internal_note)(conversation=conv, author=agent, content='Private')
            frames = []
            while (frame := await receive()) is not None:
                frames.append(frame)
            return frames
        return [f['action'] for f in session(user, steps)]

    assert 'internal_note' in frames_for(agent)
    assert 'internal_note' not in frames_for(patient)


def test_read_action_marks_the_conversation_read(patient):
    conv = factories.conversation(patient)
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)
    reply = send_message(conversation=conv, sender=agent, content='How can we help?')

    async def steps(send, receive, drain):
        await send({'action': 'read', 'conversation_id': str(conv.id)})
        await send({'action': 'ping'})      # wait until the read was processed
        await drain()

    session(patient, steps)

    assert MessageRead.objects.filter(message=reply, user=patient).exists()


def test_outsider_cannot_subscribe_to_someone_elses_conversation(patient, other_patient):
    conv = factories.conversation(patient)

    async def steps(send, receive, drain):
        await send({'action': 'subscribe', 'conversation_id': str(conv.id)})
        return await receive()

    reply = session(other_patient, steps)

    assert reply is None or reply.get('action') != 'subscribed'
