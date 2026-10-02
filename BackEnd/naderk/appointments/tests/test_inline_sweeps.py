"""List endpoints only run the cleanup sweeps inline in local development."""
from unittest.mock import patch

import pytest

pytestmark = pytest.mark.django_db

SWEEPS = {
    '/api/v1/appointments/history/': [
        'naderk.appointments.tasks.cancel_abandoned_unpaid_appointments',
        'naderk.appointments.tasks.mark_missed_appointments',
    ],
    '/api/v1/marketplace/orders/': ['naderk.ecommerce.tasks.cancel_abandoned_unpaid_orders'],
}


@pytest.mark.parametrize('url', SWEEPS)
@pytest.mark.parametrize('debug', [True, False])
def test_sweeps_run_inline_only_when_debugging(auth_client, settings, url, debug):
    settings.DEBUG = debug
    patches = [patch(target) for target in SWEEPS[url]]
    mocks = [p.start() for p in patches]
    try:
        assert auth_client.get(url).status_code == 200
    finally:
        for p in patches:
            p.stop()

    assert all(mock.called == debug for mock in mocks)
