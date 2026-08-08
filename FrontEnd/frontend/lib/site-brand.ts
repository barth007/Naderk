import 'server-only';

/**
 * Server-side brand lookup for metadata.
 *
 * Page titles, Open Graph tags, and the site name live in `generateMetadata`,
 * which runs on the server and cannot use the client `useBrand()` hook. Without
 * this, renaming the platform in the CMS updated every visible label but left
 * the browser tab, search results, and link previews on the old name.
 */
export interface SiteBrand {
  name: string;
  description: string;
  logoUrl: string | null;
}

const DEFAULT_BRAND: SiteBrand = {
  name: 'Naderk Eye Clinic',
  description:
    'Comprehensive eye care, telehealth consultations, laboratory diagnostics, and optical services with modern technology and expert support.',
  logoUrl: null,
};

export async function getSiteBrand(): Promise<SiteBrand> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return DEFAULT_BRAND;

  try {
    const res = await fetch(`${base}/cms/site-settings/`, {
      // Metadata is built per-request but the brand changes rarely; revalidate
      // hourly so a CMS rename propagates without hammering the API.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return DEFAULT_BRAND;

    const json = await res.json();
    const settings = json?.data;
    if (!settings?.company_name) return DEFAULT_BRAND;

    return {
      name: settings.company_name,
      description: DEFAULT_BRAND.description,
      logoUrl: settings.logo_url || null,
    };
  } catch {
    // The marketing site must render even when the API is unreachable.
    return DEFAULT_BRAND;
  }
}
