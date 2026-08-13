"""
Central role -> area capability map for staff scoping.

This is the single source of truth for "which role may touch which area of the
admin experience". API views enforce it via `area_forbidden()`; the frontend
receives the computed set through the auth payload (see
authentication.services._get_tokens_for_user) and uses it to filter navigation
and guard `/admin/*` routes.

Areas are coarse-grained feature groups, not per-endpoint permissions.
"""
from naderk.common.responses.builders import build_error_response

# ── Areas ────────────────────────────────────────────────────────────────────
AREA_DASHBOARD = 'dashboard'
AREA_INVENTORY = 'inventory'
AREA_ORDERS = 'orders'
AREA_CMS = 'cms'
AREA_FRAMES = 'frames'
AREA_SERVICES = 'services'
AREA_GLASS_BUILDER = 'glass_builder'
AREA_PATIENT_RECORDS = 'patient_records'
AREA_APPOINTMENTS = 'appointments'
AREA_MESSAGING = 'messaging'
AREA_BILLING = 'billing'
AREA_SETTINGS = 'settings'
AREA_STAFF = 'staff'

ALL_AREAS = frozenset({
    AREA_DASHBOARD, AREA_INVENTORY, AREA_ORDERS, AREA_CMS, AREA_FRAMES,
    AREA_SERVICES, AREA_GLASS_BUILDER, AREA_PATIENT_RECORDS, AREA_APPOINTMENTS,
    AREA_MESSAGING, AREA_BILLING, AREA_SETTINGS, AREA_STAFF,
})

# ── Role -> areas ────────────────────────────────────────────────────────────
# ADMIN / SUPER_ADMIN get every area. The clinical portals (DOCTOR, OPTICIAN,
# PATIENT, etc.) are governed by their own role-specific endpoints and are not
# listed here — this map only scopes the shared /admin staff experience.
ROLE_AREAS = {
    'SUPER_ADMIN': set(ALL_AREAS),
    'ADMIN': set(ALL_AREAS),
    'MEDICAL_AGENT': {
        AREA_DASHBOARD, AREA_INVENTORY, AREA_ORDERS, AREA_CMS, AREA_FRAMES,
        AREA_SERVICES, AREA_GLASS_BUILDER, AREA_PATIENT_RECORDS,
        AREA_APPOINTMENTS, AREA_MESSAGING,
    },
    'OPERATIONS_MANAGER': {
        AREA_INVENTORY, AREA_ORDERS, AREA_CMS, AREA_FRAMES,
    },
    'AGENT': {
        AREA_MESSAGING, AREA_APPOINTMENTS,
    },
}


def user_areas(user) -> set:
    """Return the set of areas a user's role grants (empty for unknown/anon)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return set()
    return set(ROLE_AREAS.get(getattr(user, 'role', None), set()))


def user_has_area(user, area: str) -> bool:
    return area in user_areas(user)


def area_forbidden(request, area: str):
    """
    Guard helper mirroring the existing inline style. Returns a 403 Response when
    the request's user lacks `area`, or None when access is allowed:

        if (resp := area_forbidden(request, AREA_INVENTORY)):
            return resp
    """
    if user_has_area(getattr(request, 'user', None), area):
        return None
    return build_error_response(
        'forbidden', 'Forbidden', 403,
        "You do not have access to this area.",
        instance=getattr(request, 'path', None),
    )
