"use client";

import React from 'react';
import Link from 'next/link';
import { Eye, Glasses } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Frame } from '@/services/marketplace/marketplace.types';

const naira = (v: string | number) => `₦${parseFloat(String(v)).toLocaleString()}`;

export default function FrameCard({ frame, fixedWidth = false }: { frame: Frame; fixedWidth?: boolean }) {
  const href = `/dashboard/marketplace/frame/${frame.id}`;

  return (
    <div
      className={cn(
        'group flex flex-col bg-white border border-gray-200 rounded-md overflow-hidden',
        'transition-shadow duration-200 hover:shadow-lg hover:border-gray-300',
        fixedWidth && 'w-[240px] shrink-0 snap-start',
      )}
    >
      <Link href={href} className="relative block aspect-[4/3] bg-[#f4f6fa] overflow-hidden">
        {frame.front_image ? (
          <img
            src={frame.front_image}
            alt={`${frame.brand} ${frame.name}`}
            loading="lazy"
            className="object-contain w-full h-full p-3 transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Glasses className="w-9 h-9" />
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/95 text-gray-600 border border-gray-200">
          {frame.gender_display ?? 'Frame'}
        </span>
      </Link>

      <div className="flex flex-col flex-1 p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">{frame.brand}</p>
        <Link href={href} className="mt-1 block">
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-[#ff052f] transition-colors">
            {frame.name}
          </h3>
        </Link>
        <p className="mt-1 text-xs text-gray-400 truncate">{frame.style} · {frame.material}</p>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-gray-900">{naira(frame.base_price)}</span>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ff052f] border border-[#ffccd3] hover:bg-[#fff5f6] h-9 px-3 rounded-md transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </Link>
        </div>
      </div>
    </div>
  );
}
