"use client";

import React, { useState } from 'react';
import { useBrand } from '@/services/cms/admin-cms.hooks';
import { cn } from '@/lib/cn';

const FALLBACK_LOGO = '/naderk_logo.png';

/**
 * Size presets. Each is a *bounded box* — a height budget plus a width cap —
 * rather than a fixed pixel size.
 *
 * Every render site used to hardcode its own dimensions, several of them as
 * `width={110} height={70}` attributes with no CSS sizing. That works for the
 * original tall shield mark and nothing else: swap in a wide wordmark and
 * object-contain letterboxes it inside that box, so it renders far smaller than
 * the space available. Capping height and width separately lets any aspect
 * ratio fill the space it's given.
 */
const SIZES = {
  sm: 'h-8 max-w-[130px]',
  md: 'h-9 sm:h-10 max-w-[150px] sm:max-w-[180px]',
  lg: 'h-10 sm:h-12 md:h-14 max-w-[170px] sm:max-w-[210px] md:max-w-[240px]',
} as const;

export type BrandLogoSize = keyof typeof SIZES;

export interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  /** Renders the brand name beside the mark when no logo image is configured. */
  showNameFallback?: boolean;
}

export default function BrandLogo({
  size = 'md',
  className,
  showNameFallback = false,
}: BrandLogoProps) {
  const brand = useBrand();
  const [failed, setFailed] = useState(false);

  const src = !failed && brand.logoUrl ? brand.logoUrl : FALLBACK_LOGO;

  // A newly uploaded logo that 404s (bad URL, wrong MinIO public endpoint)
  // should fall back to the bundled mark rather than leave a broken image.
  if (failed && !brand.logoUrl && showNameFallback) {
    return <span className={cn('font-bold text-lg truncate', className)}>{brand.name}</span>;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={brand.name}
      onError={() => setFailed(true)}
      className={cn('w-auto object-contain object-left shrink-0', SIZES[size], className)}
    />
  );
}
