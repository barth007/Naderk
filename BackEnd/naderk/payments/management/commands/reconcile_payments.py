from django.core.management.base import BaseCommand

from naderk.payments.tasks import reconcile_pending_transactions


class Command(BaseCommand):
    help = (
        "Verify payments still sitting at INITIATED against the provider and apply "
        "the result. Use this to repair records left behind by a webhook that never "
        "arrived — they show as 'Pending' on the admin billing page despite the money "
        "having moved. Runs automatically every 10 minutes via Celery beat; this "
        "command is for clearing an existing backlog immediately."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report what would be checked without contacting the provider.',
        )

    def handle(self, *args, **options):
        from naderk.payments.models import PaymentTransaction

        pending = PaymentTransaction.objects.filter(
            status=PaymentTransaction.Status.INITIATED,
        ).count()

        if options['dry_run']:
            self.stdout.write(f"{pending} transaction(s) currently at INITIATED.")
            self.stdout.write("Re-run without --dry-run to verify them against the provider.")
            return

        self.stdout.write(f"Found {pending} transaction(s) at INITIATED. Verifying…")
        result = reconcile_pending_transactions()
        self.stdout.write(self.style.SUCCESS(result))
