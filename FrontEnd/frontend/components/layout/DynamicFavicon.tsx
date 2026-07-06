'use client'

import { useEffect } from 'react'
import { useSiteSettings } from '@/services/cms/admin-cms.hooks'

export function DynamicFavicon() {
  const { data: settings } = useSiteSettings()

  useEffect(() => {
    const faviconUrl = settings?.favicon_url
    if (!faviconUrl) return

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = faviconUrl
  }, [settings?.favicon_url])

  return null
}
