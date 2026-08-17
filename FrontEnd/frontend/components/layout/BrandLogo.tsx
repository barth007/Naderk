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
  sm: 'h-9 max-w-[140px]',
  md: 'h-10 sm:h-11 max-w-[160px] sm:max-w-[190px]',
  lg: 'h-11 sm:h-12 md:h-14 max-w-[180px] sm:max-w-[220px] md:max-w-[260px]',
} as const;

/** Wordmark text sizes, paired to each logo box so the lockup stays balanced. */
const NAME_SIZES = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-lg sm:text-xl',
} as const;

export type BrandLogoSize = keyof typeof SIZES;

export interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  /**
   * Render the brand name as a wordmark beside the mark. Use in chrome that
   * would otherwise show no readable brand name (dashboard sidebar/navbar),
   * so a CMS rename is actually visible there — the mark alone can't convey it.
   */
  showName?: boolean;
  /** Extra classes for the wordmark text (only when showName). */
  nameClassName?: string;
}

export default function BrandLogo({
  size = 'md',
  className,
  showName = false,
  nameClassName,
}: BrandLogoProps) {
  const brand = useBrand();
  const [failed, setFailed] = useState(false);

  // A newly uploaded logo that 404s (bad URL, wrong MinIO public endpoint)
  // falls back to the bundled mark rather than leaving a broken image.
  const src = !failed && brand.logoUrl ? brand.logoUrl : FALLBACK_LOGO;

  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={brand.name}
      onError={() => setFailed(true)}
      className={cn(
        'w-auto object-contain object-left shrink-0',
        SIZES[size],
        !showName && className,
      )}
    />
  );

  if (!showName) return img;

  return (
    <span className={cn('inline-flex items-center gap-2.5 min-w-0', className)}>
      {img}
      <span
        className={cn(
          'font-bold tracking-tight text-gray-900 truncate',
          NAME_SIZES[size],
          nameClassName,
        )}
      >
        {brand.name}
      </span>
    </span>
  );
}
