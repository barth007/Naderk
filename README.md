# Naderk

An eye-care clinic platform: appointment booking, telehealth video consultations,
an optical store with a glasses builder, medical records, and a CMS-driven public
website.

## Layout

```
BackEnd/                 Django 6 + DRF API, Channels (WebSockets), Celery
  config/                settings (base, local, production, test), urls, asgi, celery
  naderk/<app>/          one Django app per domain
    apis.py              views
    services.py          writes / business rules
    selectors.py         reads
    models.py
    tests/               pytest tests for the app
  conftest.py            shared pytest fixtures
FrontEnd/frontend/       Next.js (App Router) + React Query + Zustand + Tailwind
  app/                   routes: public site, /dashboard (patients), /doctor, /admin (staff)
  components/            UI by domain
  services/              API hooks by domain
infrastructure/livekit/  LiveKit server configs (dev, prod)
scripts/                 VPS setup, nginx, backup and diagnostic scripts
docker-compose.yml       infrastructure: Postgres, Redis, LiveKit, MinIO
docker-compose.prod.yml  app services: web, celery worker, celery beat, frontend
```

Backend apps: `core` (user model), `authentication`, `users`, `appointments`,
`payments`, `ecommerce`, `telehealth`, `medical_records`, `messaging`,
`notifications`, `cms`, `dashboard`, `storage`, `common`.

## Running locally

Infrastructure:

```bash
docker compose up -d db redis livekit minio createbuckets
```

Backend:

```bash
cd BackEnd
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # then fill in real values
python manage.py migrate
python manage.py runserver
```

Celery (scheduled jobs: missed appointments, abandoned checkouts, payment
reconciliation, telehealth reminders):

```bash
celery -A config.celery_app worker --loglevel=info
celery -A config.celery_app beat --loglevel=info
```

Frontend:

```bash
cd FrontEnd/frontend
npm ci
npm run dev
```

## Tests

Backend tests live in each app's `tests/` folder and run with pytest against
Postgres:

```bash
cd BackEnd
pytest                              # everything
pytest naderk/payments              # one app
pytest naderk/payments/tests/test_lifecycle.py -k amount
```

`config/settings/test.py` is used automatically (see `pyproject.toml`).

Frontend checks:

```bash
cd FrontEnd/frontend
npm run lint && npx tsc --noEmit && npm run build
```

## Deployment

Deploys are triggered manually from the "Deploy Naderk" GitHub Action, which
syncs the chosen branch to the VPS and rebuilds the selected services with
Docker Compose. Environment files (`.env.production`, `.env.dev`) live on the
server and are never committed.
