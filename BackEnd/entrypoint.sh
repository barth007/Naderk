#!/bin/sh
set -e

# Only run migrations and static files for the web process
if [ "$1" = "" ] || [ "$1" = "daphne" ]; then
    echo "==> Running database migrations..."
    python manage.py migrate --no-input

    echo "==> Collecting static files..."
    python manage.py collectstatic --no-input --clear

    echo "==> Starting Daphne ASGI server..."
    exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
else
    # Celery worker, beat, or any other command passed directly
    echo "==> Starting: $@"
    exec "$@"
fi
