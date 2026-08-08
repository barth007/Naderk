#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Why is the backend getting InvalidAccessKeyId from MinIO?
#
# There are only two possible causes:
#   (a) the credentials in the backend env file don't match the ones the minio
#       container was started with, or
#   (b) the hostname `minio` resolves to a DIFFERENT environment's MinIO, whose
#       credentials naturally don't match.
#
# This prints everything needed to tell them apart, in one go. Read-only.
#
# Usage:  cd /var/www/naderk-dev && bash scripts/diagnose-storage-auth.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

hr() { printf '─%.0s' {1..72}; echo; }
step() { echo; hr; echo "$1"; hr; }

case "$PWD" in
  *naderk-dev) ENV_SUFFIX=dev;         PROJECT=naderk-dev ;;
  *)           ENV_SUFFIX=production;  PROJECT=naderk ;;
esac
echo "Project: $PROJECT   (env file: BackEnd/.env.$ENV_SUFFIX)"

WEB=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" \
                --filter "label=com.docker.compose.service=web" --format '{{.Names}}' | head -1)
MINIO=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" \
                  --filter "label=com.docker.compose.service=minio" --format '{{.Names}}' | head -1)

step "1. This project's containers"
echo "  web:   ${WEB:-NOT RUNNING}"
echo "  minio: ${MINIO:-NOT RUNNING (this project has no minio of its own)}"

step "2. Credentials MinIO will actually accept"
if [ -n "$MINIO" ]; then
  docker exec "$MINIO" printenv 2>/dev/null | grep -E '^MINIO_ROOT' | sed 's/^/  /'
else
  echo "  (no minio container in this project — see step 4)"
fi

step "3. Credentials the backend is sending"
grep -E '^MINIO_(ACCESS_KEY|SECRET_KEY|ENDPOINT|PUBLIC_ENDPOINT)=' \
  "BackEnd/.env.$ENV_SUFFIX" 2>/dev/null | sed 's/^/  /' || echo "  env file not readable"
echo
echo "  >> MINIO_ACCESS_KEY must equal MINIO_ROOT_USER above."
echo "  >> MINIO_SECRET_KEY must equal MINIO_ROOT_PASSWORD above."

step "4. Which MinIO does the backend actually reach?"
if [ -n "$WEB" ]; then
  RESOLVED=$(docker exec "$WEB" getent hosts minio 2>/dev/null | awk '{print $1}' | head -1)
  if [ -z "$RESOLVED" ]; then
    echo "  'minio' does not resolve from $WEB at all."
    echo "  >> The app and the storage server are on different Docker networks."
  else
    echo "  'minio' resolves to $RESOLVED from $WEB"
    OWNER=$(for c in $(docker ps -q); do
      name=$(docker inspect -f '{{.Name}}' "$c" | sed 's|^/||')
      ips=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$c")
      for ip in $ips; do [ "$ip" = "$RESOLVED" ] && echo "$name"; done
    done | head -1)
    echo "  that IP belongs to: ${OWNER:-unknown}"
    if [ -n "$OWNER" ] && [ "$OWNER" != "$MINIO" ]; then
      echo
      echo "  >> MISMATCH. The backend is talking to '$OWNER', not this"
      echo "     project's '$MINIO'. That is why the credentials are rejected."
    elif [ -n "$OWNER" ]; then
      echo "  >> Correct container. So the cause is a credential mismatch (steps 2 vs 3)."
    fi
  fi
fi

step "5. Network membership"
for c in "$WEB" "$MINIO"; do
  [ -z "$c" ] && continue
  nets=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$c")
  printf '  %-28s %s\n' "$c" "$nets"
done
echo
echo "  >> If these two lists share no network, they cannot talk by name."

step "What to do"
cat <<'EOS'
  If step 4 says MISMATCH (wrong container):
    The `minio` alias is ambiguous across environments. Point the backend at
    the container by its unique name instead, and make sure they share a
    network:

      docker network connect <this-project's-minio-network> <web-container>
      # then in BackEnd/.env.<env>:
      MINIO_ENDPOINT=http://<this-project's-minio-container>:9000

  If step 4 says "correct container" but auth still fails:
    Steps 2 and 3 disagree. Align them — easiest is to set the env file to
    match what the running MinIO already accepts, since changing MinIO's root
    credentials means recreating the container.

  Re-test either way with:
      docker exec -it <web-container> python manage.py probe_upload
EOS
