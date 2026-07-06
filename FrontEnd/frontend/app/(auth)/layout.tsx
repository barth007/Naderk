'use client'

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useBrand } from '@/services/cms/admin-cms.hooks';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = useBrand();
  const logoSrc = brand.logoUrl ?? '/naderk_logo.png';

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <Link href="/" aria-label="Go to homepage">
          <Image
            src={logoSrc}
            alt={brand.name}
            width={140}
            height={45}
            className="h-11 w-auto object-contain"
            unoptimized={!!brand.logoUrl}
          />
        </Link>
      </div>

      {children}
    </div>
  );
}
