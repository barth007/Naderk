"use client";

import { usePathname } from 'next/navigation';

export function ConditionalWrapper({ children, showOnDashboard = false }: { children: React.ReactNode, showOnDashboard?: boolean }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard') ||
                      pathname?.startsWith('/doctor') ||
                      pathname?.startsWith('/optician') ||
                      pathname?.startsWith('/agent') ||
                      pathname?.startsWith('/admin') ||
                      pathname?.startsWith('/complete-profile') ||
                      pathname?.startsWith('/onboarding') ||
                      pathname?.startsWith('/profile');

  if (isDashboard && !showOnDashboard) {
    return null;
  }

  return <>{children}</>;
}
