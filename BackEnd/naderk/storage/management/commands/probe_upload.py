"""
End-to-end probe of the image pipeline.

Uploads a tiny generated PNG through the exact code path the admin panel uses,
then tries to fetch it back three ways — internally, and via the public URL that
gets stored on products. Whichever hop fails tells you where the problem is,
without needing to click through the UI or guess.
"""
import io
import urllib.request
import urllib.error

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand

# Smallest valid PNG (1x1 transparent), so we don't depend on Pillow.
PNG_1X1 = bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4'
    '890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
)


def _fetch(url, timeout=10):
    """Returns (status, content_type, note)."""
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get('Content-Type', '?'), ''
    except urllib.error.HTTPError as e:
        body = ''
        try:
            body = e.read(300).decode('utf-8', 'replace').replace('\n', ' ')
        except Exception:
            pass
        return e.code, e.headers.get('Content-Type', '?') if e.headers else '?', body
    except Exception as e:
        return None, '?', f'{type(e).__name__}: {e}'


class Command(BaseCommand):
    help = "Upload a test image through the real storage path and verify it can be fetched back."

    def add_arguments(self, parser):
        parser.add_argument('--keep', action='store_true',
                            help='Leave the test object in the bucket (default: it stays anyway, prefixed diag/).')

    def handle(self, *args, **opts):
        cfg = settings.STORAGE
        ok = self.style.SUCCESS
        bad = self.style.ERROR
        warn = self.style.WARNING

        self.stdout.write('\n── Configuration ' + '─' * 52)
        self.stdout.write(f"  ENDPOINT        {cfg['ENDPOINT']}")
        self.stdout.write(f"  PUBLIC_ENDPOINT {cfg['PUBLIC_ENDPOINT']}")
        self.stdout.write(f"  PUBLIC_BUCKET   {cfg['PUBLIC_BUCKET']}")
        if cfg['PUBLIC_ENDPOINT'] == cfg['ENDPOINT']:
            self.stdout.write(bad('  >> PUBLIC_ENDPOINT is falling back to the internal endpoint.'))
            self.stdout.write(bad('     Stored URLs will not be reachable from a browser.'))

        self.stdout.write('\n── Upload (same code path as the admin panel) ' + '─' * 24)
        from naderk.common.storage.service import storage_service
        upload = SimpleUploadedFile('diagnostic.png', PNG_1X1, content_type='image/png')
        try:
            result = storage_service.upload_file(
                upload, bucket_type='public', prefix='diag', uploaded_by=None,
            )
        except Exception as e:
            self.stdout.write(bad(f'  UPLOAD FAILED: {type(e).__name__}: {e}'))
            self.stdout.write(warn('  The backend cannot write to MinIO at all. Check MINIO_ENDPOINT, '
                                   'credentials, and that the minio container is reachable on the '
                                   'Docker network.'))
            return
        self.stdout.write(ok('  upload succeeded'))
        self.stdout.write(f'  stored URL: {result.url}')

        key = result.url.split(f"/{cfg['PUBLIC_BUCKET']}/", 1)[-1]

        self.stdout.write('\n── Fetch checks ' + '─' * 54)

        # 1. Direct from MinIO inside the Docker network. Isolates storage from delivery.
        internal = f"{cfg['ENDPOINT'].rstrip('/')}/{cfg['PUBLIC_BUCKET']}/{key}"
        status, ctype, note = _fetch(internal)
        label = ok('OK  ') if status == 200 else bad('FAIL')
        self.stdout.write(f"  {label} internal  {status}  {ctype}  {internal}")
        if note:
            self.stdout.write(f"          {note[:160]}")
        if status == 403:
            self.stdout.write(warn('          403 here means the bucket is not anonymously readable. '
                                   'Run: mc anonymous set download <alias>/' + cfg['PUBLIC_BUCKET']))

        # 2. The URL actually saved on products — what a browser will request.
        status, ctype, note = _fetch(result.url)
        label = ok('OK  ') if status == 200 else bad('FAIL')
        self.stdout.write(f"  {label} public    {status}  {ctype}  {result.url}")
        if note:
            self.stdout.write(f"          {note[:160]}")

        self.stdout.write('\n── Verdict ' + '─' * 59)
        if status == 200 and ctype.startswith('image/'):
            self.stdout.write(ok('  The pipeline works. A newly uploaded image will display.'))
            self.stdout.write('  If the storefront still shows nothing, the images were uploaded '
                              'BEFORE this fix — repair them with:')
            self.stdout.write(f"    manage.py repair_media_urls --from <old-prefix> "
                              f"--to {cfg['PUBLIC_ENDPOINT']} --dry-run")
        elif status == 200:
            self.stdout.write(warn(f'  Fetched, but Content-Type is {ctype!r}, not an image. '
                                   'Something between MinIO and the browser is rewriting the response '
                                   '(check the nginx /media/ block).'))
        elif status is None:
            self.stdout.write(bad('  The public URL is not reachable from this container at all.'))
            self.stdout.write('  That may be DNS/egress from inside Docker rather than a real fault — '
                              'retry the same URL with curl from the host before concluding.')
        else:
            self.stdout.write(bad(f'  The public URL returns {status}. A browser gets the same. '
                                  'Fix the nginx /media/ route or MINIO_PUBLIC_ENDPOINT.'))
