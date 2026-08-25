from django.core.management.base import BaseCommand
from django.db.models import Count, Sum

from naderk.ecommerce.models import Product


class Command(BaseCommand):
    help = (
        "Reset each product's quantity_available to the sum of its variants.\n\n"
        "Sales only ever decremented the variant while restocking only ever "
        "incremented the product, so the two counters drifted. The product "
        "figure is the one the admin inventory page, its summary totals and the "
        "product serializers read, which is why sold units never reduced the "
        "displayed stock. Run once after deploying the fix."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Write the corrections. Without it the command only reports.',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']

        products = (
            Product.objects
            .annotate(n_variants=Count('variants'), variant_total=Sum('variants__quantity_available'))
            .filter(n_variants__gt=0)
            .order_by('name')
        )

        drifted = 0
        for product in products:
            variant_total = product.variant_total or 0
            if product.quantity_available == variant_total:
                continue

            drifted += 1
            delta = variant_total - product.quantity_available
            self.stdout.write(
                f"  {product.name[:40]:42} {product.quantity_available:5} -> {variant_total:5} ({delta:+d})"
            )
            if apply_changes:
                Product.objects.filter(pk=product.pk).update(quantity_available=variant_total)

        if not drifted:
            self.stdout.write(self.style.SUCCESS("All products already agree with their variants."))
            return

        if apply_changes:
            self.stdout.write(self.style.SUCCESS(f"\nReconciled {drifted} product(s)."))
        else:
            self.stdout.write(
                self.style.WARNING(f"\n{drifted} product(s) drifted. Re-run with --apply to fix.")
            )
