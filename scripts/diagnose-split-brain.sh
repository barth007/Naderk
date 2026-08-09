#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Are dev and prod sharing Docker network aliases?
#
# Both environments' app containers join the same external `naderk_net`. If both
# environments' *infrastructure* is on it too, then `db`, `redis` and `minio`
# each resolve to TWO containers. Docker's embedded DNS round-robins between
# them, so consecutive requests can hit different Postgres servers.
#
# That looks exactly like "I add a product, refresh, and sometimes it's there
# and sometimes it isn't" — but nothing is being cached. The write landed in one
# database and the read went to the other.
#
# Read-only.  Usage: bash scripts/diagnose-split-brain.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

hr() { printf '─%.0s' {1..72}; echo; }
step() { echo; hr; echo "$1"; hr; }

name_of() { docker inspect -f '{{.Name}}' "$1" 2>/dev/null | sed 's|^/||'; }

step "1. Every container claiming each service alias"
for alias in db redis minio; do
  echo "  '$alias':"
  found=0
  for c in $(docker ps -q); do
    svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$c" 2>/dev/null)
    [ "$svc" != "$alias" ] && continue
    proj=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c" 2>/dev/null)
    nets=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}' "$c")
    printf '    %-30s project=%-12s %s\n' "$(name_of "$c")" "$proj" "$nets"
    found=$((found+1))
  done
  [ "$found" -gt 1 ] && echo "    >> $found containers answer to '$alias'. If they share a network, DNS is ambiguous."
  echo
done

step "2. What does each web container actually resolve 'db' to?"
for c in $(docker ps -q); do
  svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$c" 2>/dev/null)
  [ "$svc" != "web" ] && continue
  WEBNAME=$(name_of "$c")
  echo "  from $WEBNAME — resolving 'db' 6 times:"
  ips=$(for _ in 1 2 3 4 5 6; do docker exec "$c" getent hosts db 2>/dev/null | awk '{print $1}' | head -1; done)
  echo "$ips" | sed 's/^/    /'
  uniq_count=$(echo "$ips" | sort -u | grep -c . || true)
  if [ "$uniq_count" -gt 1 ]; then
    echo "    >> RESOLVES TO $uniq_count DIFFERENT ADDRESSES. Reads and writes are"
    echo "       being split across two Postgres servers. This is the bug."
  else
    echo "    >> stable, single address"
  fi
  echo
done

step "3. Product counts, per database"
for c in $(docker ps -q); do
  svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$c" 2>/dev/null)
  [ "$svc" != "db" ] && continue
  DBNAME=$(name_of "$c")
  n=$(docker exec "$c" psql -U naderk_user -d naderk_db -tAc \
        'SELECT count(*) FROM ecommerce_product' 2>/dev/null | tr -d '[:space:]')
  latest=$(docker exec "$c" psql -U naderk_user -d naderk_db -tAc \
        'SELECT name FROM ecommerce_product ORDER BY created_at DESC LIMIT 1' 2>/dev/null | tr -d '\r')
  printf '  %-30s products=%-6s newest=%s\n' "$DBNAME" "${n:-?}" "${latest:-none}"
done
echo
echo "  >> If the counts differ, your product data is split across two databases."
echo "     Whichever one a request lands on decides whether a product 'exists'."

step "What this means"
cat <<'EOS'
  Nothing is cached server-side — there is no Django CACHES setting and Redis
  is only used for Celery and WebSockets. So intermittent disappearance can
  only mean the requests are reaching different data.

  The fix is to stop the two environments sharing a network. Each Compose
  project should own its own, so `db` / `redis` / `minio` resolve within the
  project and nowhere else.

  Do NOT change this on a live system without a maintenance window — it
  requires recreating containers in both environments.
EOS
