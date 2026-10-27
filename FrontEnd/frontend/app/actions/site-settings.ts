'use server';

import { updateTag } from 'next/cache';
import { SITE_SETTINGS_TAG } from '@/lib/site-brand-tag';

/**
 * Expire the server-side copy of the CMS site settings.
 *
 * The root layout reads them with a cached fetch (see lib/site-brand.ts) and
 * seeds the client cache from it. Without this, a CMS save was written and read
 * back correctly in the admin page, but a refresh rebuilt the page from the
 * cached copy — the old logo and name came back for up to an hour.
 */
export async function refreshSiteSettings() {
  updateTag(SITE_SETTINGS_TAG);
}
