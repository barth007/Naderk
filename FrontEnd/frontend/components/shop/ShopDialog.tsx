'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The popup shell used by the shop's quick view and login prompt: dimmed
 * backdrop, Escape and backdrop click close it, page scroll is locked, focus
 * starts on the close button. A sheet from the bottom on phones.
 */
export function ShopDialog({
  labelledBy, onClose, className, children,
}: {
  labelledBy: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-[#11111A]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl',
          className,
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm hover:bg-gray-100"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
