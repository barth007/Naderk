from decimal import Decimal

from rest_framework import serializers

from .models import Donation, VolunteerApplication
from .services import AMOUNT_LIMITS


class StartDonationSerializer(serializers.Serializer):
    donor_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    donor_email = serializers.EmailField(required=False, allow_blank=True)
    currency = serializers.ChoiceField(choices=Donation.Currency.choices, default=Donation.Currency.NGN)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    frequency = serializers.ChoiceField(choices=Donation.Frequency.choices, default=Donation.Frequency.ONE_TIME)
    dedicated_to = serializers.CharField(max_length=150, required=False, allow_blank=True)
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    provider = serializers.CharField(max_length=20, required=False, default='PAYSTACK')

    def validate(self, attrs):
        user = self.context['request'].user
        signed_in = getattr(user, 'is_authenticated', False)

        # A signed-in donor's own details fill whatever they left blank.
        name = (attrs.get('donor_name') or '').strip()
        if not name and signed_in:
            name = f"{user.first_name} {user.last_name}".strip()
        email = (attrs.get('donor_email') or '').strip()
        if not email and signed_in:
            email = user.email
        errors = {}
        if not name:
            errors['donor_name'] = ['Please tell us your name.']
        if not email:
            errors['donor_email'] = ['We need an email address to send your receipt.']

        low, high = AMOUNT_LIMITS[attrs['currency']]
        if attrs['amount'] < low:
            errors['amount'] = [f"The smallest gift is {low:,.0f} {attrs['currency']}."]
        elif attrs['amount'] > high:
            errors['amount'] = [f"For gifts above {high:,.0f} {attrs['currency']}, please contact us."]
        if errors:
            raise serializers.ValidationError(errors)

        attrs['donor_name'], attrs['donor_email'] = name, email
        attrs['provider'] = (attrs.get('provider') or 'PAYSTACK').upper()
        return attrs


class DonationSerializer(serializers.ModelSerializer):
    currency_display = serializers.CharField(source='get_currency_display', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    purpose_display = serializers.CharField(source='get_purpose_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Donation
        fields = [
            'id', 'donor_name', 'donor_email', 'currency', 'currency_display', 'amount',
            'frequency', 'frequency_display', 'purpose', 'purpose_display', 'dedicated_to', 'message',
            'status', 'status_display', 'payment_reference', 'paid_at', 'next_reminder_on',
            'reminder_sent_at', 'created_at',
        ]


class VolunteerApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VolunteerApplication
        fields = ['full_name', 'email', 'phone', 'country', 'role', 'session_format',
                  'registration_number', 'message']
        extra_kwargs = {'message': {'max_length': 2000}}

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Please tell us your name.')
        return value

    def validate_email(self, value):
        return value.strip().lower()


class VolunteerApplicationSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    session_format_display = serializers.CharField(source='get_session_format_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VolunteerApplication
        fields = [
            'id', 'full_name', 'email', 'phone', 'country', 'role', 'role_display',
            'session_format', 'session_format_display', 'registration_number', 'message',
            'status', 'status_display', 'staff_notes', 'reviewed_by_name', 'created_at', 'updated_at',
        ]

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return f"{obj.reviewed_by.first_name} {obj.reviewed_by.last_name}".strip() or obj.reviewed_by.email


class VolunteerReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=VolunteerApplication.Status.choices, required=False)
    staff_notes = serializers.CharField(required=False, allow_blank=True, max_length=4000)
