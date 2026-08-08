"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CarouselRowProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Horizontally scrolling shelf, one per category.
 *
 * Native overflow scrolling with scroll-snap does the work, so touch/trackpad
 * gestures and keyboard both behave as users expect; the arrows are a
 * pointer-device convenience layered on top and hide when there's nothing to
 * scroll to in that direction.
 */
export default function CarouselRow({ title, subtitle, icon, action, children }: CarouselRowProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // 1px tolerance: fractional scroll widths otherwise leave arrows stuck on.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    // Content arriving async (or a resize) changes what's reachable.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', sync); ro.disconnect(); };
  }, [sync, children]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    // Scroll by a viewport-worth, less one card, so nothing is skipped over.
    el.scrollBy({ left: dir * Math.max(el.clientWidth - 240, 240), behavior: 'smooth' });
  };

  const arrow = (dir: 1 | -1, disabled: boolean) => (
    <button
      onClick={() => page(dir)}
      disabled={disabled}
      aria-label={dir === 1 ? `Scroll ${title} forward` : `Scroll ${title} back`}
      className={cn(
        'w-8 h-8 rounded-md border flex items-center justify-center transition-colors',
        disabled
          ? 'border-gray-100 text-gray-200 cursor-default'
          : 'border-gray-200 text-gray-600 hover:text-[#ff052f] hover:border-[#ffccd3] bg-white',
      )}
    >
      {dir === 1 ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
    </button>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <div className="hidden sm:flex items-center gap-1.5">
            {arrow(-1, atStart)}
            {arrow(1, atEnd)}
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-1 px-1"
      >
        {children}
      </div>
    </section>
  );
}
