// utils/role-config.ts
import React from 'react';

export interface SidebarItem {
  name: string;
  href: string;
  iconName: string; // Used to dynamically map Lucide icons
}

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
      { name: 'Services', href: '/dashboard/services', iconName: 'Stethoscope' },
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
    dashboardRoute: '/agent/dashboard',
    showHospitalId: false,
    avatarLabel: 'Medical Agent',
    defaultTitle: 'Agent Portal',
    sidebarItems: [
      { name: 'Dashboard', href: '/agent/dashboard', iconName: 'LayoutGrid' },
      { name: 'Patient Chats', href: '/agent/chats', iconName: 'MessageSquare' },
      { name: 'Appointment Requests', href: '/agent/appointments', iconName: 'CalendarClock' },
      { name: 'Telehealth Queue', href: '/agent/telehealth', iconName: 'MonitorPlay' },
      { name: 'Settings', href: '/profile', iconName: 'Settings' },
    ],
    profileSections: ['personal', 'security'],
    permissions: [
      'appointments.view', 'messages.manage', 'access_patient_messaging_queue', 
      'access_appointment_coordination'
    ],
  },
  ADMIN: {
    dashboardRoute: '/admin/dashboard',
    showHospitalId: false,
    avatarLabel: 'Admin',
    defaultTitle: 'Admin Portal',
    sidebarItems: [
      { name: 'Dashboard', href: '/admin/dashboard', iconName: 'LayoutGrid' },
      { name: 'Appointments', href: '/admin/appointments', iconName: 'Calendar' },
      { name: 'Patient Records', href: '/admin/records', iconName: 'FileText' },
      { name: 'Inventory', href: '/admin/inventory', iconName: 'Layers' },
      { name: 'Order Book', href: '/admin/orders', iconName: 'BookOpen' },
      { name: 'Billing', href: '/admin/billing', iconName: 'CreditCard' },
      { name: 'Staff Management', href: '/admin/staff', iconName: 'Users' },
      { name: 'Services', href: '/admin/services', iconName: 'Stethoscope' },
      { name: 'Messages', href: '/admin/messages', iconName: 'MessageSquare' },
      { name: 'CMS', href: '/admin/cms', iconName: 'Globe' },
      { name: 'Settings', href: '/profile', iconName: 'Settings' },
    ],
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
    sidebarItems: [
      { name: 'Dashboard', href: '/admin/dashboard', iconName: 'LayoutGrid' },
      { name: 'Appointments', href: '/admin/appointments', iconName: 'Calendar' },
      { name: 'Patient Records', href: '/admin/records', iconName: 'FileText' },
      { name: 'Inventory', href: '/admin/inventory', iconName: 'Layers' },
      { name: 'Order Book', href: '/admin/orders', iconName: 'BookOpen' },
      { name: 'Billing', href: '/admin/billing', iconName: 'CreditCard' },
      { name: 'Staff Management', href: '/admin/staff', iconName: 'Users' },
      { name: 'Services', href: '/admin/services', iconName: 'Stethoscope' },
      { name: 'Messages', href: '/admin/messages', iconName: 'MessageSquare' },
      { name: 'CMS', href: '/admin/cms', iconName: 'Globe' },
      { name: 'Settings', href: '/profile', iconName: 'Settings' },
    ],
    profileSections: ['personal', 'security'],
    permissions: [
      'users.manage', 'reports.view', 'system.manage', 'access_global_reporting', 
      'access_user_management', 'access_system_configuration', 'all_permissions'
    ],
  },
};
