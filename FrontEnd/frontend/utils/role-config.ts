// utils/role-config.ts
import React from 'react';

export interface SidebarItem {
  name: string;
  href: string;
  iconName: string; // Used to dynamically map Lucide icons
  area?: string;    // Capability area gating this item (see backend permissions)
}

// Single source of nav for the shared /admin staff portal. Each item is tagged
// with its capability `area`; the sidebar filters this list by the current
// user's `areas` (returned by the backend). Items without an `area` (e.g.
// personal Settings) are always shown.
export const ADMIN_NAV: SidebarItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', iconName: 'LayoutGrid', area: 'dashboard' },
  { name: 'Appointments', href: '/admin/appointments', iconName: 'Calendar', area: 'appointments' },
  { name: 'Patient Records', href: '/admin/records', iconName: 'FileText', area: 'patient_records' },
  { name: 'Inventory', href: '/admin/inventory', iconName: 'Layers', area: 'inventory' },
  { name: 'Order Book', href: '/admin/orders', iconName: 'BookOpen', area: 'orders' },
  { name: 'Billing', href: '/admin/billing', iconName: 'CreditCard', area: 'billing' },
  { name: 'Staff Management', href: '/admin/staff', iconName: 'Users', area: 'staff' },
  { name: 'Services', href: '/admin/services', iconName: 'Stethoscope', area: 'services' },
  { name: 'Frames', href: '/admin/frames', iconName: 'Glasses', area: 'frames' },
  { name: 'Glasses Builder', href: '/admin/glasses-builder', iconName: 'SlidersHorizontal', area: 'glass_builder' },
  { name: 'Messages', href: '/admin/messages', iconName: 'MessageSquare', area: 'messaging' },
  { name: 'CMS', href: '/admin/cms', iconName: 'Globe', area: 'cms' },
  { name: 'System Settings', href: '/admin/settings', iconName: 'Cog', area: 'settings' },
  { name: 'Settings', href: '/profile', iconName: 'Settings' },
];

export interface RoleConfig {
  dashboardRoute: string;
  sidebarItems: SidebarItem[];
  profileSections: string[];
  permissions: string[];
  showHospitalId: boolean;
  avatarLabel: string;
  defaultTitle: string;
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  PATIENT: {
    dashboardRoute: '/dashboard',
    showHospitalId: true,
    avatarLabel: 'Patient',
    defaultTitle: 'Patient Portal',
    sidebarItems: [
      { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutGrid' },
      { name: 'Appointments', href: '/dashboard/appointments', iconName: 'Calendar' },
      { name: 'Medical Records', href: '/dashboard/records', iconName: 'FileText' },
      { name: 'Messages', href: '/dashboard/messages', iconName: 'MessageSquare' },
      { name: 'Telehealth', href: '/dashboard/telehealth', iconName: 'Video' },
      { name: 'Marketplace', href: '/dashboard/marketplace', iconName: 'ShoppingCart' },
      { name: 'Settings', href: '/profile', iconName: 'Settings' },
    ],
    profileSections: ['personal', 'contact', 'insurance', 'security', 'emergency'],
    permissions: [],
  },
  DOCTOR: {
    dashboardRoute: '/doctor/dashboard',
    showHospitalId: false,
    avatarLabel: 'Doctor',
    defaultTitle: 'Doctor Portal',
    sidebarItems: [
      { name: 'Dashboard', href: '/doctor/dashboard', iconName: 'LayoutGrid' },
      { name: 'Patient Records', href: '/doctor/records', iconName: 'FileText' },
      { name: 'Prescriptions', href: '/doctor/prescriptions', iconName: 'ClipboardList' },
      { name: 'My Articles', href: '/doctor/blog', iconName: 'PenLine' },
      { name: 'Messaging', href: '/doctor/messages', iconName: 'MessageSquare' },
      { name: 'Telehealth', href: '/doctor/telehealth', iconName: 'Video' },
      { name: 'Settings', href: '/profile', iconName: 'Settings' },
    ],
    profileSections: ['doctor-info', 'professional', 'availability', 'security'],
    permissions: [
      'appointments.view', 'patients.view', 'prescriptions.create', 
      'telehealth.join', 'access_patient_records', 'access_prescriptions', 
      'access_clinical_notes'
    ],
  },
  OPTICIAN: {
    dashboardRoute: '/optician/dashboard',
    showHospitalId: false,
    avatarLabel: 'Optician',
    defaultTitle: 'Optician Portal',
    sidebarItems: [
      { name: 'Dashboard', href: '/optician/dashboard', iconName: 'LayoutGrid' },
      { name: 'Prescription Reviews', href: '/optician/prescriptions', iconName: 'ClipboardCheck' },
      { name: 'Marketplace Orders', href: '/optician/orders', iconName: 'Package' },
      { name: 'Inventory', href: '/optician/inventory', iconName: 'Layers' },
      { name: 'Settings', href: '/profile', iconName: 'Settings' },
    ],
    profileSections: ['personal', 'security'],
    permissions: [
      'prescriptions.view', 'marketplace.manage', 'access_prescription_reviews', 
      'access_marketplace_fulfillment'
    ],
  },
  MEDICAL_AGENT: {
    // Medical agents work in the shared /admin portal; the sidebar is filtered
    // to their areas (everything except billing, settings, staff management).
    dashboardRoute: '/admin/dashboard',
    showHospitalId: false,
    avatarLabel: 'Medical Agent',
    defaultTitle: 'Medical Agent Portal',
    sidebarItems: ADMIN_NAV,
    profileSections: ['personal', 'security'],
    permissions: [
      'appointments.view', 'messages.manage', 'access_patient_messaging_queue',
      'access_appointment_coordination'
    ],
  },
  OPERATIONS_MANAGER: {
    // Runs the store & content: inventory, orders, CMS, frames.
    dashboardRoute: '/admin/inventory',
    showHospitalId: false,
    avatarLabel: 'Operations',
    defaultTitle: 'Operations Portal',
    sidebarItems: ADMIN_NAV,
    profileSections: ['personal', 'security'],
    permissions: [],
  },
  AGENT: {
    // Support agents: messaging/tickets + booking appointments for patients.
    dashboardRoute: '/admin/messages',
    showHospitalId: false,
    avatarLabel: 'Support',
    defaultTitle: 'Support Portal',
    sidebarItems: ADMIN_NAV,
    profileSections: ['personal', 'security'],
    permissions: [],
  },
  ADMIN: {
    dashboardRoute: '/admin/dashboard',
    showHospitalId: false,
    avatarLabel: 'Admin',
    defaultTitle: 'Admin Portal',
    sidebarItems: ADMIN_NAV,
    profileSections: ['personal', 'security'],
    permissions: [
      'users.manage', 'reports.view', 'access_global_reporting',
      'access_user_management', 'access_system_configuration'
    ],
  },
  SUPER_ADMIN: {
    dashboardRoute: '/admin/dashboard',
    showHospitalId: false,
    avatarLabel: 'Super Admin',
    defaultTitle: 'Super Admin Portal',
    sidebarItems: ADMIN_NAV,
    profileSections: ['personal', 'security'],
    permissions: [
      'users.manage', 'reports.view', 'system.manage', 'access_global_reporting',
      'access_user_management', 'access_system_configuration', 'all_permissions'
    ],
  },
};

// Map an /admin/* pathname to the capability area that guards it.
const ADMIN_PATH_AREAS: Record<string, string> = {
  dashboard: 'dashboard',
  appointments: 'appointments',
  records: 'patient_records',
  inventory: 'inventory',
  orders: 'orders',
  billing: 'billing',
  staff: 'staff',
  services: 'services',
  frames: 'frames',
  'glasses-builder': 'glass_builder',
  messages: 'messaging',
  cms: 'cms',
  settings: 'settings',
};

export function areaForAdminPath(pathname: string): string | null {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  return ADMIN_PATH_AREAS[seg] ?? null;
}

// Filter admin nav items by the areas a user holds. Items without an `area`
// (e.g. personal Settings) always show. If `areas` is undefined the list is
// returned unfiltered (nav renders normally until the backend value loads).
export function filterNavByAreas(items: SidebarItem[], areas?: string[]): SidebarItem[] {
  if (!areas) return items;
  const set = new Set(areas);
  return items.filter((i) => !i.area || set.has(i.area));
}

// The best landing route for a user given their granted areas: the role's
// configured landing when permitted, else the first admin item they can see.
export function landingRoute(role: string, areas?: string[]): string {
  const cfg = ROLE_CONFIGS[role];
  const set = new Set(areas ?? []);
  if (cfg?.dashboardRoute) {
    const area = areaForAdminPath(cfg.dashboardRoute);
    if (!area || set.has(area)) return cfg.dashboardRoute;
  }
  const first = ADMIN_NAV.find((i) => i.area && set.has(i.area));
  return first?.href ?? cfg?.dashboardRoute ?? '/dashboard';
}
