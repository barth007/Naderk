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

# Resolve containers via Compose, scoped to THIS project. A bare
# `docker ps --filter name=web` matches the production container too and
# `head -1` then picks whichever Docker lists first — which meant running this
# on the dev box happily reported production's database.
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
WEB=$("${COMPOSE[@]}" ps -q web 2>/dev/null | head -1)
MINIO=$("${COMPOSE[@]}" ps -q minio 2>/dev/null | head -1)
[ -z "$MINIO" ] && MINIO=$(docker compose -f docker-compose.yml ps -q minio 2>/dev/null | head -1)

WEB_NAME=$(docker inspect --format '{{.Name}}' "$WEB" 2>/dev/null | sed 's|^/||')
MINIO_NAME=$(docker inspect --format '{{.Name}}' "$MINIO" 2>/dev/null | sed 's|^/||')
# The network is project-scoped too, so derive it rather than assuming.
NET=$(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$MINIO" 2>/dev/null | head -1)

step "1. Containers"
[ -n "$WEB" ]   && echo -e "$PASS web:   $WEB_NAME"   || { echo -e "$FAIL no 'web' container in this project"; exit 1; }
[ -n "$MINIO" ] && echo -e "$PASS minio: $MINIO_NAME (network: ${NET:-unknown})" || echo -e "$FAIL no 'minio' container in this project"

step "2. What Django is configured to hand out as image URLs"
docker exec "$WEB" python - <<'PYEOF' 2>&1 | sed 's/^/  /'
import django
django.setup()
from django.conf import settings
s = settings.STORAGE
print(f"MINIO_ENDPOINT        = {s['ENDPOINT']}")
print(f"MINIO_PUBLIC_ENDPOINT = {s['PUBLIC_ENDPOINT']}")
print(f"PUBLIC_BUCKET         = {s['PUBLIC_BUCKET']}")
print()
if s['PUBLIC_ENDPOINT'] == s['ENDPOINT']:
    print(">> PUBLIC_ENDPOINT is falling back to the internal ENDPOINT.")
    print("   Every uploaded image gets a URL only reachable inside Docker.")
    print("   This is the usual cause.")
else:
    print(">> PUBLIC_ENDPOINT is set independently. Good.")
PYEOF

step "3. URLs actually stored on recent uploads"
docker exec "$WEB" python - <<'PYEOF' 2>&1 | sed 's/^/  /'
import django
django.setup()
from naderk.ecommerce.models import Product, Frame
from naderk.storage.models import StoredFile

rows = list(Product.objects.exclude(images=[]).order_by('-created_at')[:3])
if not rows:
    print("(no products with images in THIS database)")
for p in rows:
    print(f"product '{p.name[:26]}' -> {(p.images or ['(none)'])[0]}")
for f in Frame.objects.exclude(front_image=None).order_by('-created_at')[:2]:
    print(f"frame   '{f.name[:26]}' -> {f.front_image}")

print()
sf = list(StoredFile.objects.order_by('-id')[:3])
if sf:
    print("most recent uploads (bucket / key):")
    for x in sf:
        print(f"  {x.bucket} / {x.object_key}")
else:
    print("no StoredFile rows — nothing uploaded through the storage service yet")
PYEOF

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
if [ -n "$MINIO" ] && [ -n "$NET" ]; then
  AK=$(docker exec "$MINIO" printenv MINIO_ROOT_USER 2>/dev/null || echo minioadmin)
  SK=$(docker exec "$MINIO" printenv MINIO_ROOT_PASSWORD 2>/dev/null || echo minioadmin123)
  # Join the same network the minio container is actually on — hardcoding
  # `naderk_net` fails on dev, whose network is project-prefixed.
  docker run --rm --network "$NET" --entrypoint sh minio/mc:latest -c \
    "mc alias set n http://${MINIO_NAME}:9000 '$AK' '$SK' >/dev/null 2>&1 || exit 1; \
     echo 'buckets:'; mc ls n 2>&1; \
     echo 'anonymous policy on naderk-public:'; mc anonymous get n/naderk-public 2>&1" \
    2>/dev/null | sed 's/^/  /' \
    || echo -e "$INFO could not run mc against $NET (non-fatal — step 7 is the real test)"
else
  echo -e "$INFO skipped (minio container or network not resolved)"
fi

step "6. End-to-end fetch of a real object over HTTPS"
URL=$(docker exec "$WEB" python - <<'PYEOF' 2>/dev/null
import django
django.setup()
from django.conf import settings
from naderk.ecommerce.models import Product, Frame
from naderk.storage.models import StoredFile

p = Product.objects.exclude(images=[]).order_by('-created_at').first()
if p and p.images:
    print(p.images[0]); raise SystemExit
f = Frame.objects.exclude(front_image=None).order_by('-created_at').first()
if f and f.front_image:
    print(f.front_image); raise SystemExit
# Nothing in the catalogue yet — build a URL for the newest raw upload so the
# hop can still be tested end to end.
x = StoredFile.objects.order_by('-id').first()
if x:
    print(f"{settings.STORAGE['PUBLIC_ENDPOINT'].rstrip('/')}/{x.bucket}/{x.object_key}")
PYEOF
)
URL=$(echo "$URL" | tr -d '\r' | head -1)
if [ -z "$URL" ]; then
  echo -e "$INFO nothing uploaded yet to test"
else
  echo "  stored URL: $URL"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$URL" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo -e "$PASS fetches successfully (HTTP 200) — browsers can load this"
  else
    echo -e "$FAIL HTTP '$code' — a browser cannot load this either"
  fi
fi

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
