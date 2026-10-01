"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { SiteSettings } from '@/services/cms/admin-cms.hooks';

export default function QueryProvider({
  children,
  initialSiteSettings = null,
}: {
  children: React.ReactNode;
  /**
   * CMS settings already fetched on the server for <head> metadata.
   *
   * Seeding them into the cache means useSiteSettings() returns the real brand
   * during SSR *and* on the client's first render. Before this, the server
   * rendered the fallback name/logo while the client rendered the CMS values,
   * and the hydration mismatch made React throw away the server tree and
   * rebuild it on the client — taking with it the DOM nodes an early click had
   * already landed on.
   */
  initialSiteSettings?: SiteSettings | null;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          retry: 1,
        },
      },
    });

    if (initialSiteSettings) {
      client.setQueryData(['cms-site-settings'], initialSiteSettings);
    }

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
