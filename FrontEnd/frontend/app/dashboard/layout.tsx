"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import DashboardNavbar from '@/components/layout/DashboardNavbar';
import { SidebarProvider } from '@/context/SidebarContext';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api';
import { landingRoute, areaForAdminPath } from '@/utils/role-config';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, isAuthenticated, setUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync user info with auth/me endpoint
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const response = await apiClient.get('/auth/me/');
        if (response.data?.data) {
          setUser(response.data.data);
        }
      } catch (error) {
        console.warn("Failed to sync auth/me metadata:", error);
      }
    };
    if (mounted && isAuthenticated) {
      fetchMe();
    }
  }, [mounted, isAuthenticated, setUser]);

  useEffect(() => {
    if (mounted) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user) {
        // Redirection for all roles with incomplete profiles
        if (user.profile_completion_status !== 'COMPLETED') {
          router.push('/onboarding');
          return;
        }

        // Role-based path checks to keep each role in its own portal.
        const currentPath = pathname || '';
        const ADMIN_PORTAL_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MEDICAL_AGENT', 'OPERATIONS_MANAGER', 'AGENT'];
        const onDashboard = currentPath.startsWith('/dashboard') && currentPath !== '/dashboard/profile';
        const onAdmin = currentPath.startsWith('/admin');

        if (user.role === 'DOCTOR' && (onDashboard || onAdmin)) {
          router.push('/doctor/dashboard');
        } else if (user.role === 'PATIENT' && (currentPath.startsWith('/doctor') || onAdmin)) {
          router.push('/dashboard');
        } else if (user.role === 'OPTICIAN' && (onDashboard || onAdmin)) {
          router.push('/optician/dashboard');
        } else if (ADMIN_PORTAL_ROLES.includes(user.role)) {
          // Staff portals live under /admin; send them there from /dashboard...
          if (onDashboard) {
            router.push(landingRoute(user.role, user.areas));
          } else if (onAdmin) {
            // ...and enforce per-area access inside it.
            const area = areaForAdminPath(currentPath);
            if (area && !(user.areas || []).includes(area)) {
              router.push(landingRoute(user.role, user.areas));
            }
          }
        }
      }
    }
  }, [mounted, isAuthenticated, user, pathname, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--destructive)]" />
      </div>
    );
  }

  // If user hasn't completed profile, return null while useEffect redirects
  if (user && user.profile_completion_status !== 'COMPLETED') {
    return null;
  }

  const hideSidebar = pathname === '/dashboard/profile' || pathname === '/profile';
  const isProfilePage = pathname === '/dashboard/profile' || pathname === '/profile';

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen bg-[#f8f9fc] overflow-hidden">
        {/* Top Navbar spans 100% width */}
        <DashboardNavbar />

        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar (hidden on mobile until toggled) */}
          {!hideSidebar && <DashboardSidebar />}

          <main className="flex-1 overflow-y-auto">
            <div className="w-full max-w-7xl mx-auto p-4 md:p-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
