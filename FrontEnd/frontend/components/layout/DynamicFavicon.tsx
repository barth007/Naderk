'use client'

import { useEffect } from 'react'
import { useSiteSettings } from '@/services/cms/admin-cms.hooks'

/**
 * Points the browser tab icon at the CMS-configured favicon (falling back to the
 * logo), overriding the static icons emitted by the root layout's metadata.
 *
 * The layout hardcodes `icons: { icon, shortcut, apple }` → `/icon.png`, so the
 * head ships with a modern `rel="icon"` link that browsers prefer over the
 * legacy `rel="shortcut icon"`. Updating a single link left that authoritative
 * one pointing at the bundled file, so a CMS logo/favicon change never reached
 * the tab. Here we strip every icon link and install our own, so the CMS wins.
 */
export function DynamicFavicon() {
  const { data: settings } = useSiteSettings()

  useEffect(() => {
    // Prefer an explicit favicon; otherwise use the logo, so changing the logo
    // is reflected in the tab even when no separate favicon has been uploaded.
    const url = settings?.favicon_url || settings?.logo_url
    if (!url) return

    const head = document.head

    // Remove the static build-time icons and any earlier ones we added, so the
    // browser can't fall back to the previous /icon.png.
    head
      .querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']")
      .forEach((el) => el.remove())

    const icon = document.createElement('link')
    icon.rel = 'icon'
    icon.href = url
    head.appendChild(icon)

    const apple = document.createElement('link')
    apple.rel = 'apple-touch-icon'
    apple.href = url
    head.appendChild(apple)
  }, [settings?.favicon_url, settings?.logo_url])

  return null
}
