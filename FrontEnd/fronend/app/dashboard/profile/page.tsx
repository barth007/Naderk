// app/dashboard/profile/page.tsx
"use client";

import React from 'react';
import ProfileLayout from '@/components/profile/ProfileLayout';
import { Breadcrumbs } from '@/components/ui/breadcrumb';

export default function ProfilePage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Breadcrumbs />
      <ProfileLayout />
    </div>
  );
}
