"""
Postmark webhook handlers.

Configure these endpoints in your Postmark server settings → Webhooks.
Postmark POSTs JSON to each URL on the relevant event.

Optional signature verification: set POSTMARK_WEBHOOK_TOKEN in .env and
enable "X-Postmark-Signature-256" header auth in the Postmark dashboard.
"""

import json
import logging
from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.utils.decorators import method_decorator

from .selectors import get_log_by_provider_id
from .constants import EmailStatus, EmailEventType, BounceType
from .utils import verify_postmark_webhook, safe_log_payload

logger = logging.getLogger(__name__)


def _get_webhook_token() -> str | None:
    return getattr(settings, 'POSTMARK_WEBHOOK_TOKEN', None)


def _verify(request) -> bool:
    token = _get_webhook_token()
    if not token:
        return True  # signature verification disabled
    sig = request.headers.get('X-Postmark-Signature-256', '')
    return verify_postmark_webhook(request.body, token, sig)


def _record_event(message_id: str, event_type: str, payload: dict,
                  status: str, timestamp_field: str | None = None) -> None:
    from .models import EmailLog, EmailEvent

    log = get_log_by_provider_id(message_id)
    if not log:
        logger.warning("Postmark webhook: no EmailLog for message_id=%s", message_id)
        return

    ts = timezone.now()

    # Update log status and timestamp
    update_fields = ['status']
    log.status = status
    if timestamp_field:
        setattr(log, timestamp_field, ts)
        update_fields.append(timestamp_field)
    log.save(update_fields=update_fields)

    # Append immutable event row
    EmailEvent.objects.create(
        email_log=log,
        event_type=event_type,
        provider='postmark',
        payload=safe_log_payload(payload),
        timestamp=ts,
    )


@method_decorator(csrf_exempt, name='dispatch')
class PostmarkDeliveryWebhook(View):
    def post(self, request):
        if not _verify(request):
            return JsonResponse({'error': 'Invalid signature'}, status=401)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        message_id = data.get('MessageID', '')
        _record_event(message_id, EmailEventType.DELIVERED, data,
                      EmailStatus.DELIVERED, 'delivered_at')
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class PostmarkBounceWebhook(View):
    def post(self, request):
        if not _verify(request):
            return JsonResponse({'error': 'Invalid signature'}, status=401)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        message_id = data.get('MessageID', '')
        bounce_type_raw = data.get('Type', '')
        log = get_log_by_provider_id(message_id)
        if log:
            from .models import EmailEvent
            ts = timezone.now()
            log.status = EmailStatus.BOUNCED
            log.bounced_at = ts
            log.bounce_type = (
                BounceType.HARD if bounce_type_raw in (
                    'HardBounce', 'BadEmailAddress', 'InvalidDomain'
                ) else BounceType.SOFT
            )
            log.save(update_fields=['status', 'bounced_at', 'bounce_type'])
            EmailEvent.objects.create(
                email_log=log,
                event_type=EmailEventType.BOUNCED,
                provider='postmark',
                payload=safe_log_payload(data),
                timestamp=ts,
            )
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class PostmarkSpamWebhook(View):
    def post(self, request):
        if not _verify(request):
            return JsonResponse({'error': 'Invalid signature'}, status=401)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        message_id = data.get('MessageID', '')
        _record_event(message_id, EmailEventType.COMPLAINED, data,
                      EmailStatus.COMPLAINED, 'complained_at')
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class PostmarkOpenWebhook(View):
    def post(self, request):
        if not _verify(request):
            return JsonResponse({'error': 'Invalid signature'}, status=401)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        message_id = data.get('MessageID', '')
        log = get_log_by_provider_id(message_id)
        if log:
            from .models import EmailEvent
            ts = timezone.now()
            # Only promote status if not already at a higher state
            if log.status not in (EmailStatus.CLICKED,):
                log.status = EmailStatus.OPENED
                log.opened_at = log.opened_at or ts
                log.save(update_fields=['status', 'opened_at'])
            EmailEvent.objects.create(
                email_log=log,
                event_type=EmailEventType.OPENED,
                provider='postmark',
                payload=safe_log_payload(data),
                timestamp=ts,
            )
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class PostmarkClickWebhook(View):
    def post(self, request):
        if not _verify(request):
            return JsonResponse({'error': 'Invalid signature'}, status=401)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        message_id = data.get('MessageID', '')
        log = get_log_by_provider_id(message_id)
        if log:
            from .models import EmailEvent
            ts = timezone.now()
            log.status = EmailStatus.CLICKED
            log.clicked_at = log.clicked_at or ts
            log.save(update_fields=['status', 'clicked_at'])
            EmailEvent.objects.create(
                email_log=log,
                event_type=EmailEventType.CLICKED,
                provider='postmark',
                payload=safe_log_payload(data),
                timestamp=ts,
            )
        return JsonResponse({'ok': True})
