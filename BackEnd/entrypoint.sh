#!/bin/sh
set -e

# Only run migrations and static files for the web process
if [ "$1" = "" ] || [ "$1" = "uvicorn" ]; then
    echo "==> Running database migrations..."
    python manage.py migrate --no-input

    echo "==> Seeding CMS content (skips if already seeded)..."
    python manage.py seed_cms

    echo "==> Seeding editable page copy (never overwrites edits)..."
    python manage.py seed_page_content

    echo "==> Collecting static files..."
    python manage.py collectstatic --no-input --clear

    # Postgres allows 100 connections. Web uses up to WEB_CONCURRENCY x
    # DB_POOL_MAX_SIZE (40 by default), Celery about 5, leaving headroom for
    # migrations and psql sessions. Set WEB_DB_POOL_MAX_SIZE in the env file to
    # change it; it is exported here so Celery, which must not pool, never sees it.
    export DB_POOL_MAX_SIZE="${WEB_DB_POOL_MAX_SIZE:-10}"

    # Several worker processes, not one. A single Daphne process could hash only
    # a few passwords a second, so under load requests queued without limit
    # and the server never caught up after the load stopped.
    #
    # --limit-concurrency caps open connections and in-flight requests per
    # worker; past it, new requests get an immediate 503 instead of joining the
    # queue. WebSockets count towards it, so leave room for chat and calls.
    echo "==> Starting Uvicorn (${WEB_CONCURRENCY:-4} workers)..."
    exec uvicorn config.asgi:application \
        --host 0.0.0.0 --port 8000 \
        --workers "${WEB_CONCURRENCY:-4}" \
        --limit-concurrency "${WEB_MAX_CONCURRENCY:-200}" \
        --no-server-header
else
    # Celery worker, beat, or any other command passed directly
    echo "==> Starting: $@"
    exec "$@"
fi
