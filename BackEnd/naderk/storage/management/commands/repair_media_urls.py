"""
Rewrite stored media URLs that were saved with an unreachable prefix.

Uploads are persisted as absolute URLs built from MINIO_PUBLIC_ENDPOINT at the
time of upload. If that setting was wrong (falling back to the internal
`http://minio:9000`), every image saved during that period carries a URL no
browser can resolve — and fixing the setting only helps *new* uploads. This
rewrites the old ones in place.
"""
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings


class Command(BaseCommand):
    help = (
        "Rewrite stored image URLs from an old (unreachable) prefix to the current "
        "MINIO_PUBLIC_ENDPOINT. Run with --dry-run first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--from', dest='old_prefix', required=True,
            help='The broken prefix to replace, e.g. http://minio:9000',
        )
        parser.add_argument(
            '--to', dest='new_prefix', default=None,
            help='Replacement prefix. Defaults to the configured MINIO_PUBLIC_ENDPOINT.',
        )
        parser.add_argument('--dry-run', action='store_true', help='Report changes without applying them.')

    def handle(self, *args, **opts):
        from naderk.ecommerce.models import Product, Frame
        from naderk.cms.models import SiteSettings

        old = opts['old_prefix'].rstrip('/')
        new = (opts['new_prefix'] or settings.STORAGE.get('PUBLIC_ENDPOINT', '')).rstrip('/')

        if not new:
            raise CommandError('No replacement prefix. Pass --to or set MINIO_PUBLIC_ENDPOINT.')
        if old == new:
            raise CommandError('--from and --to are identical; nothing to do.')

        dry = opts['dry_run']
        self.stdout.write(f"Rewriting {old!r} -> {new!r}{'  (dry run)' if dry else ''}\n")

        changed = 0

        # Products: images is a JSON list, front-most entry drives the card.
        for p in Product.objects.all():
            imgs = p.images or []
            fixed = [u.replace(old, new, 1) if isinstance(u, str) and u.startswith(old) else u for u in imgs]
            if fixed != imgs:
                changed += 1
                self.stdout.write(f"  product  {p.name[:34]:<36} {fixed[0][:70]}")
                if not dry:
                    p.images = fixed
                    p.save(update_fields=['images'])

        # Frames carry both a list and a denormalised front_image.
        for f in Frame.objects.all():
            imgs = f.images or []
            fixed = [u.replace(old, new, 1) if isinstance(u, str) and u.startswith(old) else u for u in imgs]
            front = f.front_image
            new_front = front.replace(old, new, 1) if isinstance(front, str) and front.startswith(old) else front
            if fixed != imgs or new_front != front:
                changed += 1
                self.stdout.write(f"  frame    {f.name[:34]:<36} {(new_front or '')[:70]}")
                if not dry:
                    f.images = fixed
                    f.front_image = new_front
                    f.save(update_fields=['images', 'front_image'])

        # The site logo and favicon come through the same upload path.
        s = SiteSettings.objects.first()
        if s:
            for field in ('logo_url', 'favicon_url'):
                val = getattr(s, field, '') or ''
                if val.startswith(old):
                    changed += 1
                    self.stdout.write(f"  settings {field:<36} {val.replace(old, new, 1)[:70]}")
                    if not dry:
                        setattr(s, field, val.replace(old, new, 1))
            if not dry:
                s.save()

        if changed == 0:
            self.stdout.write(self.style.SUCCESS(f"\nNothing matched the prefix {old!r}."))
        elif dry:
            self.stdout.write(self.style.WARNING(
                f"\n{changed} record(s) would change. Re-run without --dry-run to apply."))
        else:
            self.stdout.write(self.style.SUCCESS(f"\nRewrote {changed} record(s)."))
