#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Dump every Postgres container on this host before touching Docker volumes or
# networks. Run this FIRST — recreating containers with a different volume name
# makes Postgres start against an empty data directory, which looks exactly like
# total data loss even though the old volume still exists.
#
# Usage:  bash scripts/backup-databases.sh [output-dir]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

OUT="${1:-/root/naderk-backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
echo "Writing to $OUT"
echo

found=0
for c in $(docker ps -q); do
  svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$c" 2>/dev/null || true)
  [ "$svc" != "db" ] && continue
  name=$(docker inspect -f '{{.Name}}' "$c" | sed 's|^/||')
  proj=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c" 2>/dev/null || echo unknown)
  vol=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$c")

  file="$OUT/${proj}_${name}.sql"
  echo "  $name  (project=$proj, volume=${vol:-?})"
  if docker exec "$c" pg_dump -U naderk_user -d naderk_db > "$file" 2>/dev/null; then
    size=$(wc -c < "$file" | tr -d ' ')
    rows=$(grep -c '^INSERT\|^COPY' "$file" 2>/dev/null || echo '?')
    echo "    -> $file  (${size} bytes, ${rows} data statements)"
    if [ "$size" -lt 1000 ]; then
      echo "    !! suspiciously small — verify before relying on it"
    fi
  else
    echo "    !! DUMP FAILED — do not proceed with any volume change"
  fi
  # Record the volume each database was using, so the mapping is recoverable.
  echo "$name volume=$vol project=$proj" >> "$OUT/volume-map.txt"
  found=$((found+1))
done

echo
if [ "$found" -eq 0 ]; then
  echo "No 'db' containers found — nothing backed up."
  exit 1
fi
echo "Backed up $found database(s)."
echo
echo "Volume mapping recorded in $OUT/volume-map.txt:"
sed 's/^/  /' "$OUT/volume-map.txt"
echo
echo "Restore later with:"
echo "  cat <dump.sql> | docker exec -i <db-container> psql -U naderk_user -d naderk_db"
