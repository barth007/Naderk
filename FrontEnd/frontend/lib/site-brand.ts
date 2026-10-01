import 'server-only';
import type { SiteSettings } from '@/services/cms/admin-cms.hooks';

/**
 * Server-side CMS site settings.
 *
 * Page titles, Open Graph tags, the favicon and the site name live in
 * `generateMetadata`, which runs on the server and cannot use the client
 * `useBrand()` hook. Without this, renaming the platform in the CMS updated
 * every visible label but left the browser tab, search results, and link
 * previews on the old name.
 *
 * The raw settings are also handed to QueryProvider to seed the client cache,
 * so the server and the client's first render agree on the brand. They did not
 * before, and the resulting hydration mismatch made React discard the
 * server-rendered tree and rebuild it — which drops the DOM nodes a first
 * click had already landed on.
 */
export interface SiteBrand {
  name: string;
  description: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const DEFAULT_DESCRIPTION =
  'Comprehensive eye care, telehealth consultations, laboratory diagnostics, and optical services with modern technology and expert support.';

const DEFAULT_BRAND: SiteBrand = {
  name: 'Naderk Eye Clinic',
  description: DEFAULT_DESCRIPTION,
  logoUrl: null,
  faviconUrl: null,
};

/**
 * Fetches the full CMS site settings, or null when unset/unreachable.
 *
 * Metadata is built per-request but the brand changes rarely; revalidate
 * hourly so a CMS rename propagates without hammering the API. Next dedupes
 * identical fetches within a render pass, so calling this from both
 * `generateMetadata` and the layout body costs one request.
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;

  try {
    const res = await fetch(`${base}/cms/site-settings/`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const json = await res.json();
    return (json?.data as SiteSettings) ?? null;
  } catch {
    // The marketing site must render even when the API is unreachable.
    return null;
  }
}

export function brandFromSettings(settings: SiteSettings | null): SiteBrand {
  if (!settings?.company_name) return DEFAULT_BRAND;
  return {
    name: settings.company_name,
    description: DEFAULT_DESCRIPTION,
    logoUrl: settings.logo_url || null,
    faviconUrl: settings.favicon_url || null,
  };
}

export async function getSiteBrand(): Promise<SiteBrand> {
  return brandFromSettings(await getSiteSettings());
}
