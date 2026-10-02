"""EmailService: every send renders its template, is logged, and its outcome recorded."""
from unittest.mock import patch

import pytest
from celery.exceptions import Retry
from django.core import mail

from naderk.common.email import selectors
from naderk.common.email._provider_registry import get_provider
from naderk.common.email.exceptions import EmailDeliveryError, EmailProviderError
from naderk.common.email.models import EmailLog
from naderk.common.email.providers.base import Attachment
from naderk.common.email.services import email_service
from naderk.common.email.tasks import send_bulk_email_task, send_email_task
from naderk.common.email.utils import safe_log_payload, strip_html

pytestmark = pytest.mark.django_db

SEND = 'naderk.common.email.providers.smtp.SMTPProvider.send'


@pytest.fixture(autouse=True)
def brand(settings):
    settings.BRAND_NAME = 'Naderk'
    settings.FRONTEND_URL = 'https://app.naderk.test/'


def sent():
    """The single message that went out, and its log row."""
    assert len(mail.outbox) == 1
    return mail.outbox[0], EmailLog.objects.get()


def html_of(message):
    return message.alternatives[0][0]


# ── One test per transactional email ─────────────────────────────────────────

def test_password_reset(patient):
    email_service.send_password_reset(user=patient, reset_url='https://app.naderk.test/reset?token=abc', sync=True)

    message, log = sent()
    assert message.to == [patient.email]
    assert message.subject == 'Reset your Naderk password'
    assert 'https://app.naderk.test/reset?token=abc' in html_of(message)
    assert (log.status, log.tags, log.template_name) == (
        'sent', ['password-reset'], 'email/authentication/password_reset.html')
    assert log.sent_at is not None


def test_otp(patient):
    email_service.send_otp(user=patient, code='482913')

    message, log = sent()
    assert '482913' in html_of(message) and '482913' in message.body
    assert log.metadata == {'user_id': str(patient.id)}


def test_welcome_links_to_the_login_page(patient):
    email_service.send_welcome(user=patient)

    message, _ = sent()
    assert message.subject == 'Welcome to Naderk!'
    assert 'https://app.naderk.test/login' in html_of(message)


def test_email_verification(patient):
    email_service.send_email_verification(user=patient, verification_url='https://app.naderk.test/verify/xyz')

    assert 'https://app.naderk.test/verify/xyz' in html_of(sent()[0])


def test_appointment_confirmation(patient):
    email_service.send_appointment_confirmation(
        user=patient, doctor_name='Dr. Okafor', date='12 March', time='10:00',
        appointment_type='Telehealth', reference='APT-1',
    )

    message, log = sent()
    assert message.subject == 'Appointment Confirmed — 12 March at 10:00'
    assert 'Dr. Okafor' in html_of(message)
    assert log.metadata == {'reference': 'APT-1'}


def test_appointment_reminder(patient):
    email_service.send_appointment_reminder(
        user=patient, doctor_name='Dr. Okafor', date='12 March', time='10:00',
        time_until='1 hour', appointment_type='Physical',
    )

    assert '1 hour' in html_of(sent()[0])


def test_appointment_cancellation(patient):
    email_service.send_appointment_cancellation(
        user=patient, doctor_name='Dr. Okafor', date='12 March', time='10:00', reason='Doctor unavailable',
    )

    message, _ = sent()
    assert message.subject == 'Appointment Cancelled — 12 March'
    assert 'Doctor unavailable' in html_of(message)


def test_order_confirmation(patient):
    email_service.send_order_confirmation(
        user=patient, reference='ORD-7', total='₦25,000',
        items=[{'name': 'Wayfarer', 'quantity': 1, 'price': '₦25,000'}],
    )

    message, _ = sent()
    assert message.subject == 'Order Confirmed — #ORD-7'
    assert 'Wayfarer' in html_of(message)


def test_payment_receipt(patient):
    email_service.send_payment_receipt(
        user=patient, reference='NDK-1', description='Consultation', amount='₦8,500', payment_date='12 March',
    )

    assert 'NDK-1' in html_of(sent()[0])


def test_prescription_ready(patient):
    email_service.send_prescription_ready(user=patient, doctor_name='Dr. Okafor')

    assert sent()[0].subject == 'Your prescription from Dr. Okafor is ready'


def test_general_notification():
    email_service.send_notification(
        recipient_email='someone@naderk.test', title='Heads up', message='Something changed',
        action_url='https://app.naderk.test/x', action_label='Open',
    )

    message, log = sent()
    assert message.to == ['someone@naderk.test']
    assert 'Something changed' in html_of(message)
    assert log.tags == ['notification']


def test_raw_email_gets_a_text_fallback_and_carries_attachments():
    with patch(SEND, return_value='') as send:
        email_service.send_raw(
            to=['a@naderk.test', 'b@naderk.test'], subject='Report', html_body='<p>Hello<br>there</p>',
            attachments=[Attachment(filename='r.pdf', content=b'%PDF', content_type='application/pdf')],
        )

    message = send.call_args.args[0]
    assert message.text_body == 'Hello\nthere'
    assert message.attachments[0].filename == 'r.pdf'
    assert bytes(message.attachments[0].content) == b'%PDF'
    assert EmailLog.objects.get().recipient == 'a@naderk.test, b@naderk.test'


def test_send_now_bypasses_the_queue_and_the_log():
    email_service.send_now(to=['a@naderk.test'], subject='Now', html_body='<b>Hi</b>')

    assert mail.outbox[0].body == 'Hi'
    assert not EmailLog.objects.exists()


def test_patient_name_falls_back_to_the_email_address(patient):
    patient.first_name = patient.last_name = ''

    email_service.send_prescription_ready(user=patient, doctor_name='Dr. Okafor')

    assert patient.email in html_of(sent()[0])


# ── Outcomes ─────────────────────────────────────────────────────────────────

def test_synchronous_failure_is_logged_and_raised(patient):
    with patch(SEND, side_effect=EmailProviderError('smtp down')), pytest.raises(EmailProviderError):
        email_service.send_password_reset(user=patient, reset_url='x', sync=True)

    log = EmailLog.objects.get()
    assert (log.status, log.error_message) == ('failed', 'smtp down')


def test_provider_message_id_is_kept_for_matching_webhooks(patient):
    with patch(SEND, return_value='pm-123'):
        email_service.send_welcome(user=patient)

    assert selectors.get_log_by_provider_id('pm-123') == EmailLog.objects.get()


def queued_log():
    return EmailLog.objects.create(recipient='a@naderk.test', subject='S', provider='smtp')


def payload(**extra):
    return {'to': ['a@naderk.test'], 'subject': 'S', 'html_body': '<p>x</p>', **extra}


def test_task_marks_a_rejected_address_failed_without_retrying():
    log = queued_log()

    with patch(SEND, side_effect=EmailDeliveryError('bad address')) as send:
        send_email_task.apply(args=[str(log.id), 'smtp', payload()])

    log.refresh_from_db()
    assert (log.status, log.error_message) == ('failed', 'bad address')
    assert send.call_count == 1


def test_task_asks_for_a_retry_on_a_provider_outage_and_leaves_the_email_queued():
    log = queued_log()

    with patch(SEND, side_effect=EmailProviderError('timeout')), pytest.raises((Retry, EmailProviderError)):
        send_email_task.apply(args=[str(log.id), 'smtp', payload()])

    log.refresh_from_db()
    assert (log.status, log.error_message) == ('queued', 'timeout')


def test_task_records_an_unexpected_error():
    log = queued_log()

    with patch(SEND, side_effect=RuntimeError('boom')):
        send_email_task.apply(args=[str(log.id), 'smtp', payload()])

    log.refresh_from_db()
    assert (log.status, log.error_message) == ('failed', 'boom')


def test_task_ignores_a_log_that_no_longer_exists():
    with patch(SEND) as send:
        send_email_task.apply(args=['00000000-0000-0000-0000-000000000000', 'smtp', payload()])

    send.assert_not_called()


def test_bulk_task_marks_every_log_sent():
    logs = [queued_log(), queued_log()]

    with patch(SEND, side_effect=['id-1', 'id-2']):
        send_bulk_email_task.apply(args=[[str(l.id) for l in logs], 'smtp', [payload(), payload()]])

    assert sorted(EmailLog.objects.values_list('status', 'provider_message_id')) == [
        ('sent', 'id-1'), ('sent', 'id-2'),
    ]


def test_bulk_task_marks_every_log_failed_on_an_unexpected_error():
    logs = [queued_log(), queued_log()]

    with patch(SEND, side_effect=RuntimeError('boom')):
        send_bulk_email_task.apply(args=[[str(l.id) for l in logs], 'smtp', [payload(), payload()]])

    assert set(EmailLog.objects.values_list('status', flat=True)) == {'failed'}


# ── SMTP provider ────────────────────────────────────────────────────────────

def test_smtp_provider_sends_html_with_a_text_alternative(settings):
    from naderk.common.email.providers.base import EmailMessage
    settings.DEFAULT_FROM_EMAIL = 'no-reply@naderk.test'

    get_provider('smtp').send(EmailMessage(
        to=['a@naderk.test'], subject='S', html_body='<p>Hi</p>', cc=['c@naderk.test'],
        reply_to='help@naderk.test',
    ))

    message = mail.outbox[0]
    assert (message.from_email, message.cc, message.reply_to) == (
        'no-reply@naderk.test', ['c@naderk.test'], ['help@naderk.test'])
    assert message.body == 'Hi'
    assert message.alternatives[0] == ('<p>Hi</p>', 'text/html')


def test_smtp_provider_adds_the_postmark_stream_header_only_on_postmarks_gateway(settings):
    from naderk.common.email.providers.base import EmailMessage
    settings.POSTMARK_MESSAGE_STREAM = 'outbound'
    msg = EmailMessage(to=['a@naderk.test'], subject='S', html_body='<p>Hi</p>')

    settings.EMAIL_HOST = 'smtp.postmarkapp.com'
    get_provider('smtp').send(msg)
    settings.EMAIL_HOST = 'mail.example.com'
    get_provider('smtp').send(msg)

    assert mail.outbox[0].extra_headers == {'X-PM-Message-Stream': 'outbound'}
    assert mail.outbox[1].extra_headers == {}


# ── Selectors and utilities ──────────────────────────────────────────────────

def test_failed_emails_selector_and_status_flags():
    for status in ['sent', 'delivered', 'opened', 'bounced', 'failed', 'complained']:
        EmailLog.objects.create(recipient='a@naderk.test', subject=status, provider='smtp', status=status)

    assert {log.subject for log in selectors.get_failed_emails()} == {'bounced', 'failed', 'complained'}
    assert {log.subject for log in EmailLog.objects.all() if log.is_delivered} == {'delivered', 'opened'}
    assert {log.subject for log in EmailLog.objects.all() if log.is_failed} == {'bounced', 'failed', 'complained'}
    assert selectors.daily_send_count('a@naderk.test') == 6
    assert len(selectors.get_emails_for_recipient('a@naderk.test', limit=2)) == 2


def test_strip_html():
    assert strip_html('<h1>Hi</h1><br/>there<br>\n\n\n\nyou') == 'Hi\nthere\n\nyou'


def test_webhook_payloads_are_stored_without_secrets():
    assert safe_log_payload({'MessageID': '1', 'Token': 't', 'password': 'p', 'KEY': 'k'}) == {'MessageID': '1'}
