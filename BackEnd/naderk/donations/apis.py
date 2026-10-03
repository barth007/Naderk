import logging

from django.db.models import Count, Q, Sum
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from naderk.common.permissions import AREA_DONATIONS, area_forbidden
from naderk.common.responses.builders import build_error_response, build_success_response

from .models import Donation, VolunteerApplication
from .serializers import (
    DonationSerializer, StartDonationSerializer, VolunteerApplicationCreateSerializer,
    VolunteerApplicationSerializer, VolunteerReviewSerializer,
)
from .services import start_donation, submit_volunteer_application

logger = logging.getLogger(__name__)


def _validation_error(errors):
    return build_error_response("validation-error", "Validation Error", 400,
                                "One or more validation errors occurred.", errors=errors)


def _checkout_payload(donation, txn_reference, access_code, public_config, provider):
    return {
        'donation_id': str(donation.id),
        'reference': txn_reference,
        'access_code': access_code,
        'public_key': public_config.get('public_key', ''),
        'public_config': public_config,
        'provider': provider,
        # What the payment popup must charge, in the currency's minor unit.
        'amount_minor': donation.amount_minor,
        'currency': donation.currency,
        'email': donation.donor_email,
        'donor_name': donation.donor_name,
    }


class DonationCreateApi(APIView):
    """
    POST /api/v1/donations/

    Start a gift. No account needed: name and email are taken from the form, or
    from the signed-in user when they are left blank. Returns what the payment
    popup needs; the gift is confirmed through POST /donations/verify/ (or the
    provider's webhook) once the donor pays.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'donations'

    def post(self, request):
        from naderk.payments.models import PaymentTransaction
        from naderk.payments.services import provider_public_config

        idempotency_key = request.headers.get('Idempotency-Key', '').strip()
        if idempotency_key:
            existing = (
                PaymentTransaction.objects.select_related('donation')
                .filter(idempotency_key=idempotency_key, donation__isnull=False).first()
            )
            if existing:
                return build_success_response("Payment already started", _checkout_payload(
                    existing.donation, existing.reference, existing.raw_response.get('access_code', ''),
                    provider_public_config(existing.provider), existing.provider,
                ))

        serializer = StartDonationSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return _validation_error(serializer.errors)
        data = serializer.validated_data

        try:
            donation, result = start_donation(
                user=request.user,
                donor_name=data['donor_name'],
                donor_email=data['donor_email'],
                currency=data['currency'],
                amount=data['amount'],
                frequency=data['frequency'],
                dedicated_to=data.get('dedicated_to', ''),
                message=data.get('message', ''),
                provider_name=data['provider'],
                idempotency_key=idempotency_key or None,
            )
        except ValueError as e:
            # Unknown provider, or one that cannot take this currency.
            return build_error_response("validation-error", "Payment not available", 400, str(e))
        except Exception as e:
            logger.exception("Donation payment initialisation failed: %s", e)
            return build_error_response(
                "provider-error", "Payment initialization failed", 502,
                "We could not reach the payment provider. Nothing has been charged — please try again.",
            )

        return build_success_response("Donation started", _checkout_payload(
            donation, result.reference, result.access_code, result.public_config, data['provider'],
        ), status_code=201)


class DonationVerifyApi(APIView):
    """
    POST /api/v1/donations/verify/  { "reference": "NDK-..." }

    Ask the provider whether the gift was paid and record it if so. Safe to
    call repeatedly; the page polls it after the popup reports success.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'donation_verify'

    def post(self, request):
        from naderk.payments.models import PaymentTransaction
        from naderk.payments.services import confirm_and_fulfill

        reference = (request.data.get('reference') or '').strip()
        if not reference:
            return _validation_error({'reference': ['This field is required.']})

        txn = (PaymentTransaction.objects.select_related('donation')
               .filter(reference=reference, donation__isnull=False).first())
        if txn is None:
            return build_error_response("not-found", "Donation not found", 404,
                                        "No gift was started with that reference.")

        if txn.donation.status != Donation.Status.PAID:
            try:
                confirm_and_fulfill(reference=reference)
            except Exception as e:
                logger.exception("Donation verify failed for %s: %s", reference, e)
                return build_error_response(
                    "provider-error", "Could not verify payment", 502,
                    "We could not reach the payment provider. If you were charged, "
                    "your gift will be confirmed shortly.",
                )
            txn.donation.refresh_from_db()

        donation = txn.donation
        return build_success_response("Donation status", {
            'donation_id': str(donation.id),
            'status': donation.status,
            'amount': str(donation.amount),
            'currency': donation.currency,
            'frequency': donation.frequency,
            'purpose': donation.purpose,
            'next_reminder_on': donation.next_reminder_on.isoformat() if donation.next_reminder_on else None,
        })


class VolunteerApplyApi(APIView):
    """POST /api/v1/donations/volunteers/ — offer to volunteer. Saved for staff to review."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'volunteers'

    def post(self, request):
        serializer = VolunteerApplicationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error(serializer.errors)
        application = submit_volunteer_application(**serializer.validated_data)
        return build_success_response(
            "Thank you — we will be in touch.",
            {'id': str(application.id), 'full_name': application.full_name, 'role': application.role},
            status_code=201,
        )


# ── Admin ────────────────────────────────────────────────────────────────────

def _page(request, queryset, default_size=25):
    try:
        page = max(1, int(request.query_params.get('page', 1)))
        size = max(1, min(100, int(request.query_params.get('page_size', default_size))))
    except (TypeError, ValueError):
        page, size = 1, default_size
    total = queryset.count()
    start = (page - 1) * size
    return queryset[start:start + size], {
        'count': total, 'page': page, 'page_size': size,
        'total_pages': (total + size - 1) // size,
    }


class AdminDonationListApi(APIView):
    """GET /api/v1/donations/admin/donations/ — gifts, with paid totals per currency."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (denied := area_forbidden(request, AREA_DONATIONS)):
            return denied

        qs = Donation.objects.all()
        params = request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'].upper())
        if params.get('frequency'):
            qs = qs.filter(frequency=params['frequency'].upper())
        if params.get('currency'):
            qs = qs.filter(currency=params['currency'].upper())
        if params.get('q'):
            q = params['q'].strip()
            qs = qs.filter(Q(donor_name__icontains=q) | Q(donor_email__icontains=q)
                           | Q(payment_reference__icontains=q))

        paid = Donation.objects.filter(status=Donation.Status.PAID)
        totals = [
            {'currency': row['currency'], 'amount': str(row['amount']), 'count': row['count']}
            for row in paid.values('currency').annotate(amount=Sum('amount'), count=Count('id')).order_by('currency')
        ]
        rows, meta = _page(request, qs)
        return build_success_response("Donations", {
            **meta,
            'totals': totals,
            'annual_donors': paid.filter(frequency=Donation.Frequency.ANNUAL)
                                 .values('donor_email').distinct().count(),
            'results': DonationSerializer(rows, many=True).data,
        })


class AdminVolunteerListApi(APIView):
    """GET /api/v1/donations/admin/volunteers/ — volunteer applications."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (denied := area_forbidden(request, AREA_DONATIONS)):
            return denied

        qs = VolunteerApplication.objects.select_related('reviewed_by')
        params = request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'].upper())
        if params.get('role'):
            qs = qs.filter(role=params['role'].upper())
        if params.get('q'):
            q = params['q'].strip()
            qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q))

        counts = dict(VolunteerApplication.objects.values_list('status').annotate(n=Count('id')))
        rows, meta = _page(request, qs)
        return build_success_response("Volunteer applications", {
            **meta,
            'status_counts': {status: counts.get(status, 0) for status in VolunteerApplication.Status.values},
            'results': VolunteerApplicationSerializer(rows, many=True).data,
        })


class AdminVolunteerDetailApi(APIView):
    """PATCH /api/v1/donations/admin/volunteers/<id>/ — move an application along, keep notes."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if (denied := area_forbidden(request, AREA_DONATIONS)):
            return denied
        application = VolunteerApplication.objects.filter(pk=pk).first()
        if application is None:
            return build_error_response("not-found", "Not found", 404, "Volunteer application not found.")

        serializer = VolunteerReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error(serializer.errors)
        for field, value in serializer.validated_data.items():
            setattr(application, field, value)
        application.reviewed_by = request.user
        application.save()
        return build_success_response("Application updated", VolunteerApplicationSerializer(application).data)
