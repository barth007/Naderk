'use client'

import React from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/layout/BrandLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <Link href="/" aria-label="Go to homepage">
          <BrandLogo size="lg" showName />
        </Link>
      </div>

      {children}
    </div>
  );
}
