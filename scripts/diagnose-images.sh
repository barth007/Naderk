#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Why aren't uploaded images showing?
#
# Walks every hop between "admin uploads a file" and "browser renders it", and
# reports which one breaks. Read-only — changes nothing.
#
# Usage, on the server:
#   cd /var/www/naderk-dev            # or /var/www/naderk for production
#   bash scripts/diagnose-images.sh
#
# Optionally pass the public hostname if it isn't derivable:
#   bash scripts/diagnose-images.sh dev-api.naderkela.com
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

HOSTNAME_ARG="${1:-}"
PASS="  \033[0;32m✓\033[0m"
FAIL="  \033[0;31m✗\033[0m"
INFO="  \033[0;34mi\033[0m"

hr() { printf '─%.0s' {1..70}; echo; }
step() { echo; hr; echo "$1"; hr; }

# Resolve which compose project we're in, so `exec` targets the right container.
ENVIRONMENT="${ENVIRONMENT:-}"
if [ -z "$ENVIRONMENT" ] && [ -f .env ]; then
  ENVIRONMENT=$(grep -E '^ENVIRONMENT=' .env | cut -d= -f2)
fi
if [ -z "$ENVIRONMENT" ]; then
  case "$PWD" in
    *naderk-dev) ENVIRONMENT=dev ;;
    *)           ENVIRONMENT=production ;;
  esac
  echo -e "$INFO ENVIRONMENT not set; inferred '$ENVIRONMENT' from $PWD"
fi
export ENVIRONMENT

WEB=$(docker ps --filter "name=web" --format '{{.Names}}' | head -1)
MINIO=$(docker ps --filter "name=minio" --format '{{.Names}}' | head -1)

step "1. Containers"
[ -n "$WEB" ]   && echo -e "$PASS web:   $WEB"   || { echo -e "$FAIL no running 'web' container"; exit 1; }
[ -n "$MINIO" ] && echo -e "$PASS minio: $MINIO" || echo -e "$FAIL no running 'minio' container — uploads cannot be stored or served"

step "2. What Django is configured to hand out as image URLs"
docker exec "$WEB" python -c "
from django.conf import settings
import django; django.setup()
s = settings.STORAGE
print(f\"  MINIO_ENDPOINT        = {s['ENDPOINT']}\")
print(f\"  MINIO_PUBLIC_ENDPOINT = {s['PUBLIC_ENDPOINT']}\")
print(f\"  PUBLIC_BUCKET         = {s['PUBLIC_BUCKET']}\")
same = s['PUBLIC_ENDPOINT'] == s['ENDPOINT']
print()
if same:
    print('  >> PUBLIC_ENDPOINT is falling back to the internal ENDPOINT.')
    print('     Every uploaded image is stored with a URL only reachable from')
    print('     inside the Docker network. This is the usual cause.')
else:
    print('  >> PUBLIC_ENDPOINT is set independently. Good.')
" 2>/dev/null || echo -e "$FAIL could not read settings from the web container"

step "3. URLs actually stored on recent uploads"
docker exec "$WEB" python -c "
import django; django.setup()
from naderk.ecommerce.models import Product, Frame
from naderk.storage.models import StoredFile

rows = list(Product.objects.exclude(images=[]).order_by('-created_at')[:3])
if not rows:
    print('  (no products with images)')
for p in rows:
    print(f\"  product '{p.name[:28]}' -> {(p.images or ['(none)'])[0]}\")
for f in Frame.objects.exclude(front_image=None).order_by('-created_at')[:2]:
    print(f\"  frame   '{f.name[:28]}' -> {f.front_image}\")
print()
sf = StoredFile.objects.order_by('-id')[:3]
if sf:
    print('  most recent StoredFile rows (bucket / object key):')
    for s in sf:
        print(f\"    {s.bucket} / {s.object_key}\")
else:
    print('  no StoredFile rows — nothing has been uploaded through the storage service')
" 2>/dev/null || echo -e "$FAIL could not query the database"

step "4. Is MinIO reachable from the host, and on which port?"
for port in 9000 9001 9002; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$port/minio/health/live" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo -e "$PASS MinIO healthy on host port $port"
  else
    echo -e "$INFO nothing healthy on $port (HTTP '$code')"
  fi
done
echo
echo "  Published ports on the minio container:"
docker port "$MINIO" 2>/dev/null | sed 's/^/    /' || echo "    (none)"

step "5. Bucket exists and allows anonymous download?"
if [ -n "$MINIO" ]; then
  docker run --rm --network naderk_net --entrypoint sh minio/mc:latest -c "
    mc alias set n http://minio:9000 \${MINIO_ACCESS_KEY:-minioadmin} \${MINIO_SECRET_KEY:-minioadmin123} >/dev/null 2>&1
    echo '  buckets:'; mc ls n 2>/dev/null | sed 's/^/    /'
    echo '  anonymous policy on naderk-public:'
    mc anonymous get n/naderk-public 2>&1 | sed 's/^/    /'
  " 2>/dev/null || echo -e "$INFO could not run mc (non-fatal)"
fi

step "6. End-to-end fetch of a real object over HTTPS"
docker exec "$WEB" python -c "
import django; django.setup()
from naderk.ecommerce.models import Product
p = Product.objects.exclude(images=[]).order_by('-created_at').first()
print((p.images or [''])[0] if p else '')
" 2>/dev/null | tr -d '\r' | while read -r url; do
  [ -z "$url" ] && { echo -e "$INFO no product image URL to test"; continue; }
  echo "  stored URL: $url"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$url" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo -e "$PASS fetches successfully (HTTP 200) — the URL is fine"
  else
    echo -e "$FAIL HTTP '$code' — a browser cannot load this either"
  fi
done

if [ -n "$HOSTNAME_ARG" ]; then
  step "7. Does the nginx /media/ route work?"
  probe="https://$HOSTNAME_ARG/media/naderk-public/"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$probe")
  echo "  $probe -> HTTP $code"
  echo "  (403/404 from MinIO means the route reaches it; 502/504 means it does not)"
fi

step "Summary"
cat <<'EOS'
  If step 2 said PUBLIC_ENDPOINT is falling back, that is the cause. Fix:

    1. Add to BackEnd/.env.<environment>:
         MINIO_PUBLIC_ENDPOINT=https://<your-api-host>/media
       matching the port your nginx `location /media/` proxies to (step 4).

    2. Restart the backend:
         ENVIRONMENT=$ENVIRONMENT docker compose \
           -f docker-compose.yml -f docker-compose.prod.yml up -d web

    3. Existing images keep their old broken URLs — only new uploads get the
       correct prefix. Re-upload them, or rewrite the stored URLs in place.
EOS
