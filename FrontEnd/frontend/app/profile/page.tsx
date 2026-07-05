// app/profile/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import ProfileLayout from '@/components/profile/ProfileLayout';
import { LayoutGrid, ChevronRight } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();

  const dashboardHref = user?.role === 'DOCTOR'
    ? '/doctor/dashboard'
    : user?.role === 'OPTICIAN'
    ? '/optician/dashboard'
    : user?.role === 'MEDICAL_AGENT'
    ? '/agent/dashboard'
    : user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    ? '/admin/dashboard'
    : '/dashboard';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 py-3">
        <Link href={dashboardHref} className="flex items-center gap-2 hover:text-gray-900">
          <LayoutGrid className="w-5 h-5" />
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-300 mx-1 shrink-0" />
        <span className="text-[#E03E3E]">Profile</span>
      </div>

      <ProfileLayout />
    </div>
  );
}
