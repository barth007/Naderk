"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { useBrand } from '@/services/cms/admin-cms.hooks';
import { Sidebar, SidebarContent, SidebarItem, SidebarFooter, SidebarSection } from '@/components/ui/sidebar';
import { ROLE_CONFIGS } from '@/utils/role-config';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);

  const activeRole = user?.role || 'PATIENT';
  const roleConfig = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.PATIENT;
  const brand = useBrand();
  const navItems = roleConfig.sidebarItems;

  useEffect(() => {
    const fetchPatientId = async () => {
      try {
        const response = await apiClient.get('/users/profile/');
        setPatientId(response.data?.data?.patient_id);
      } catch (error) {
        console.warn("Failed to fetch patient id:", error);
      }
    };
    if (activeRole === 'PATIENT' && user?.profile_completion_status === 'COMPLETED') {
        fetchPatientId();
    }
  }, [user, activeRole]);

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`;
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  const getDisplayName = () => {
    const fullName = user?.first_name && user?.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user?.email?.split('@')[0] || "User";
      
    if (activeRole === 'DOCTOR') {
      return `Dr. ${fullName}`;
    }
    return fullName;
  };

  const getSubtext = () => {
    if (activeRole === 'PATIENT') {
      return `ID: ${patientId || 'NE-PENDING'}`;
    }
    if (activeRole === 'DOCTOR') {
      return user?.specialization || 'Ophthalmologist';
    }
    return roleConfig.avatarLabel;
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 z-50 h-full transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 w-64 shrink-0
      `}>
        <Sidebar className="h-full rounded-none md:rounded-none bg-white border-r border-gray-100 w-full" width="100%">

          {/* Navigation Links */}
          <SidebarContent className="px-4 py-6">
            <SidebarSection>
              <div className="space-y-1.5">
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.name}
                    href={item.href}
                    icon={renderIcon(item.iconName)}
                    active={pathname === item.href}
                    onClick={() => setIsMobileOpen(false)}
                    as={Link}
                    className={pathname === item.href ? "bg-[#E03E3E] text-white hover:bg-[#E03E3E] hover:text-white" : "text-gray-600 hover:bg-gray-50"}
                  >
                    {item.name}
                  </SidebarItem>
                ))}
              </div>
            </SidebarSection>
          </SidebarContent>

          {/* User Footer Component */}
          <SidebarFooter className="border-t border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 overflow-hidden text-gray-700 font-bold flex items-center justify-center border-2 border-white shadow-sm">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
                  ) : getInitials()}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-gray-900 leading-tight truncate">
                    {getDisplayName()}
                  </span>
                  <span className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                    {getSubtext()}
                  </span>
                </div>
              </div>
              
              <Link 
                  href="/profile" 
                  className="p-1.5 shrink-0 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Settings / Profile"
              >
                <LucideIcons.Settings className="w-5 h-5" />
              </Link>
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* Mobile Top Navbar Trigger (Only visible on mobile) */}
      <div className="md:hidden fixed top-0 w-full h-16 flex items-center px-4 z-40 bg-white border-b border-gray-100 justify-between">
         <img src={brand.logoUrl ?? '/naderk_logo.png'} alt={brand.name} className="h-11 object-contain" />
         <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-[#E03E3E]">
          <LucideIcons.LayoutGrid className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}

