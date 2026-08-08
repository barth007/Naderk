"use client";

import React from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag, Eye, ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Product } from '@/services/marketplace/marketplace.types';

const naira = (v: string | number) => `₦${parseFloat(String(v)).toLocaleString()}`;

export interface ProductCardProps {
  product: Product;
  inWishlist: boolean;
  onToggleWishlist: (id: string, e: React.MouseEvent) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
  isAddingToCart?: boolean;
  /** Fixed width for horizontal carousel rows; grid cells stay fluid. */
  fixedWidth?: boolean;
}

export default function ProductCard({
  product,
  inWishlist,
  onToggleWishlist,
  onAddToCart,
  isAddingToCart = false,
  fixedWidth = false,
}: ProductCardProps) {
  const href = `/dashboard/marketplace/product/${product.id}`;
  const hasVariants = !!product.variants && product.variants.length > 0;
  const image = product.images?.[0];
  const outOfStock = product.quantity_available !== undefined && product.quantity_available <= 0;

  return (
    <div
      className={cn(
        'group relative flex flex-col bg-white border border-gray-200 rounded-md overflow-hidden',
        'transition-shadow duration-200 hover:shadow-lg hover:border-gray-300',
        fixedWidth && 'w-[240px] shrink-0 snap-start',
      )}
    >
      {/* Media — 4:3 reads better than a square for mixed product photography */}
      <Link href={href} className="relative block aspect-[4/3] bg-[#f4f6fa] overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageOff className="w-8 h-8" />
          </div>
        )}

        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 bg-white px-3 py-1 rounded-md border border-gray-200">
              Out of stock
            </span>
          </div>
        )}

        {/* Hover affordance — makes "this opens a detail page" explicit on
            pointer devices without stealing the tap target on touch. */}
        <span className="absolute inset-x-0 bottom-0 hidden sm:flex items-center justify-center gap-1.5 bg-gray-900/80 text-white text-[11px] font-semibold py-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <Eye className="w-3.5 h-3.5" /> View details
        </span>
      </Link>

      <button
        onClick={e => onToggleWishlist(product.id, e)}
        aria-label={inWishlist ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        aria-pressed={inWishlist}
        className={cn(
          'absolute top-2.5 right-2.5 p-2 rounded-md border transition-colors',
          inWishlist
            ? 'bg-[#ff052f] text-white border-[#ff052f]'
            : 'bg-white/95 text-gray-400 border-gray-200 hover:text-[#ff052f] hover:border-[#ffccd3]',
        )}
      >
        <Heart className={cn('w-4 h-4', inWishlist && 'fill-current')} />
      </button>

      {/* Body — grows so every footer in a row lines up regardless of name length */}
      <div className="flex flex-col flex-1 p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
          {product.category_name}
        </p>

        <Link href={href} className="mt-1 block">
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-[#ff052f] transition-colors">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1 text-xs text-gray-400 line-clamp-2 min-h-[2rem]">
          {product.description}
        </p>

        <div className="mt-auto pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-extrabold text-gray-900">{naira(product.price)}</span>
            {hasVariants && (
              <span className="text-[11px] font-semibold text-gray-400">
                {product.variants!.length} options
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {hasVariants ? (
              // Variants carry price modifiers, so the choice must be made on
              // the detail page rather than silently adding the base product.
              <Link
                href={href}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#ff052f] hover:bg-[#d90022] text-white text-xs font-bold h-9 rounded-md transition-colors"
              >
                Select options
              </Link>
            ) : (
              <button
                onClick={e => onAddToCart(product, e)}
                disabled={isAddingToCart || outOfStock}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#ff052f] hover:bg-[#d90022] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold h-9 rounded-md transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Add to cart
              </button>
            )}

            {/* Always-visible route to the detail page — the card itself is a
                link, but nothing signalled that on touch devices. */}
            <Link
              href={href}
              aria-label={`View details for ${product.name}`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 text-gray-500 hover:text-[#ff052f] hover:border-[#ffccd3] transition-colors shrink-0"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
