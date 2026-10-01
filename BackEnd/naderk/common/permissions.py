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


# Roles whose areas can be edited in the admin "Manage Permissions" UI. ADMIN /
# SUPER_ADMIN are intentionally excluded — they always hold every area and must
# not be lockable. DOCTOR/OPTICIAN/PATIENT are governed by their own portals.
AREA_EDITABLE_ROLES = ['MEDICAL_AGENT', 'OPERATIONS_MANAGER', 'AGENT']

# Catalog for the Manage Permissions UI (each `key` must be a valid area).
AREA_CATALOG = [
    {'key': AREA_DASHBOARD,       'label': 'Dashboard',        'category': 'General'},
    {'key': AREA_APPOINTMENTS,    'label': 'Appointments',     'category': 'Clinical Ops'},
    {'key': AREA_PATIENT_RECORDS, 'label': 'Patient Records',  'category': 'Clinical Ops'},
    {'key': AREA_MESSAGING,       'label': 'Messaging',        'category': 'Clinical Ops'},
    {'key': AREA_INVENTORY,       'label': 'Inventory',        'category': 'Store'},
    {'key': AREA_ORDERS,          'label': 'Order Book',       'category': 'Store'},
    {'key': AREA_FRAMES,          'label': 'Frames',           'category': 'Store'},
    {'key': AREA_SERVICES,        'label': 'Services',         'category': 'Store'},
    {'key': AREA_GLASS_BUILDER,   'label': 'Glasses Builder',  'category': 'Store'},
    {'key': AREA_CMS,             'label': 'CMS Content',      'category': 'Content'},
    {'key': AREA_BILLING,         'label': 'Billing',          'category': 'Administration'},
    {'key': AREA_STAFF,           'label': 'Staff Management', 'category': 'Administration'},
    {'key': AREA_SETTINGS,        'label': 'System Settings',  'category': 'Administration'},
]


def default_areas_for(role) -> set:
    """Built-in default areas for a role, before any admin override."""
    return set(ROLE_AREAS.get(role, set()))


def resolved_areas_for_role(role) -> set:
    """
    Effective areas for a role: ADMIN/SUPER_ADMIN always get everything; every
    other role uses the admin-saved override (RolePermissionConfig) when one
    exists, otherwise the built-in default. Never raises — falls back to the
    defaults if the config table is unavailable (e.g. during migrations).
    """
    if role in ('ADMIN', 'SUPER_ADMIN'):
        return set(ALL_AREAS)
    try:
        from naderk.users.models import RolePermissionConfig
        cfg = RolePermissionConfig.objects.filter(role=role).first()
    except Exception:
        cfg = None
    if cfg is not None and cfg.permissions is not None:
        return {a for a in cfg.permissions if a in ALL_AREAS}
    return default_areas_for(role)


def user_areas(user) -> set:
    """Return the set of areas a user's role grants (empty for unknown/anon)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return set()
    return resolved_areas_for_role(getattr(user, 'role', None))


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
