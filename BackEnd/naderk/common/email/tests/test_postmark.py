"""The Postmark adapter: what is sent, and how each kind of refusal is classified."""
import base64
from unittest.mock import Mock, patch

import pytest
import requests

from naderk.common.email.exceptions import EmailConfigurationError, EmailDeliveryError, EmailProviderError
from naderk.common.email.providers.base import Attachment, EmailMessage
from naderk.common.email.providers.postmark import PostmarkProvider

POST = 'naderk.common.email.providers.postmark.requests.post'


@pytest.fixture(autouse=True)
def postmark_settings(settings):
    settings.POSTMARK_SERVER_TOKEN = 'server-token'
    settings.POSTMARK_MESSAGE_STREAM = 'outbound'
    settings.DEFAULT_FROM_EMAIL = 'Naderk <no-reply@naderk.test>'
    settings.DEFAULT_REPLY_TO_EMAIL = ''


def message(**extra):
    return EmailMessage(to=['a@naderk.test'], subject='Hello', html_body='<p>Hi</p>', **extra)


def reply(status=200, body=None, json_error=False):
    res = Mock(status_code=status, text='<html>gateway</html>')
    if json_error:
        res.json.side_effect = ValueError('not json')
    else:
        res.json.return_value = {'ErrorCode': 0, 'MessageID': 'pm-1'} if body is None else body
    return res


def test_send_returns_the_message_id_and_authenticates_with_the_server_token():
    with patch(POST, return_value=reply()) as post:
        message_id = PostmarkProvider().send(message())

    assert message_id == 'pm-1'
    assert post.call_args.args[0] == 'https://api.postmarkapp.com/email'
    assert post.call_args.kwargs['headers']['X-Postmark-Server-Token'] == 'server-token'


def test_payload_shape():
    payload = PostmarkProvider()._build_payload(message(
        text_body='Hi', cc=['c@naderk.test'], bcc=['b1@naderk.test', 'b2@naderk.test'], reply_to='help@naderk.test',
        tags=['otp', 'auth'], metadata={'user_id': 42}, track_links=False,
        attachments=[
            Attachment(filename='r.pdf', content=b'%PDF', content_type='application/pdf'),
            Attachment(filename='logo.png', content=b'img', content_type='image/png', inline=True),
        ],
    ))

    assert payload['From'] == 'Naderk <no-reply@naderk.test>'
    assert (payload['To'], payload['Cc'], payload['Bcc']) == ('a@naderk.test', 'c@naderk.test', 'b1@naderk.test, b2@naderk.test')
    assert (payload['ReplyTo'], payload['MessageStream'], payload['TextBody']) == ('help@naderk.test', 'outbound', 'Hi')
    assert payload['Tag'] == 'otp'                                    # Postmark allows one tag
    assert payload['Metadata'] == {'user_id': '42'}
    assert (payload['TrackOpens'], payload['TrackLinks']) == (True, 'None')
    assert payload['Attachments'][0] == {
        'Name': 'r.pdf', 'Content': base64.b64encode(b'%PDF').decode(), 'ContentType': 'application/pdf'}
    assert payload['Attachments'][1]['ContentID'] == 'cid:logo.png'


def test_optional_fields_are_left_out_and_the_default_reply_to_is_used(settings):
    bare = PostmarkProvider()._build_payload(message())
    assert not {'TextBody', 'ReplyTo', 'Cc', 'Bcc', 'Tag', 'Metadata', 'Attachments'} & set(bare)

    settings.DEFAULT_REPLY_TO_EMAIL = 'support@naderk.test'
    assert PostmarkProvider()._build_payload(message())['ReplyTo'] == 'support@naderk.test'
    assert PostmarkProvider()._build_payload(message(message_stream='broadcast'))['MessageStream'] == 'broadcast'


@pytest.mark.parametrize('status, body, expected', [
    (401, {'ErrorCode': 10, 'Message': 'Bad token'}, EmailConfigurationError),
    (422, {'ErrorCode': 300, 'Message': 'Invalid email'}, EmailDeliveryError),
    (200, {'ErrorCode': 406, 'Message': 'Inactive recipient'}, EmailDeliveryError),
    (429, {'ErrorCode': 0, 'Message': 'Slow down'}, EmailProviderError),
    (500, {'ErrorCode': 0, 'Message': 'Oops'}, EmailProviderError),
])
def test_refusals_are_classified_so_only_transient_ones_are_retried(status, body, expected):
    with patch(POST, return_value=reply(status, body)), pytest.raises(expected):
        PostmarkProvider().send(message())


def test_network_failure_and_non_json_replies_are_provider_errors():
    with patch(POST, side_effect=requests.ConnectionError('dns')), pytest.raises(EmailProviderError):
        PostmarkProvider().send(message())
    with patch(POST, return_value=reply(502, json_error=True)), pytest.raises(EmailProviderError):
        PostmarkProvider().send(message())


def test_missing_token_is_a_configuration_error_before_any_request(settings):
    settings.POSTMARK_SERVER_TOKEN = ''

    with patch(POST) as post, pytest.raises(EmailConfigurationError):
        PostmarkProvider().send(message())
    post.assert_not_called()
    with pytest.raises(EmailConfigurationError):
        PostmarkProvider().validate_configuration()


def test_bulk_send_keeps_order_and_blanks_the_failed_items():
    body = [{'ErrorCode': 0, 'MessageID': 'pm-1'}, {'ErrorCode': 406, 'Message': 'Inactive'},
            {'ErrorCode': 0, 'MessageID': 'pm-3'}]

    with patch(POST, return_value=reply(200, body)) as post:
        ids = PostmarkProvider().send_bulk([message(), message(), message()])

    assert ids == ['pm-1', '', 'pm-3']
    assert post.call_args.args[0].endswith('/email/batch')
    assert len(post.call_args.kwargs['json']) == 3


def test_bulk_send_edge_cases():
    with patch(POST) as post:
        assert PostmarkProvider().send_bulk([]) == []
    post.assert_not_called()
    with patch(POST, return_value=reply(401, {'ErrorCode': 10, 'Message': 'Bad token'})), pytest.raises(EmailConfigurationError):
        PostmarkProvider().send_bulk([message()])
    with patch(POST, side_effect=requests.Timeout()), pytest.raises(EmailProviderError):
        PostmarkProvider().send_bulk([message()])


def test_delivery_status_lookup_never_raises():
    get = 'naderk.common.email.providers.postmark.requests.get'
    found = Mock(status_code=200)
    found.json.return_value = {'Status': 'Sent'}

    with patch(get, return_value=found):
        assert PostmarkProvider().get_delivery_status('pm-1') == 'sent'
    with patch(get, return_value=Mock(status_code=404)):
        assert PostmarkProvider().get_delivery_status('pm-1') is None
    with patch(get, side_effect=requests.ConnectionError()):
        assert PostmarkProvider().get_delivery_status('pm-1') is None
