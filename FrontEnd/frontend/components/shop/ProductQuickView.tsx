'use client';

import { useState } from 'react';
import { Heart, ImageOff, Minus, Plus, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useShopUi } from '@/store/useShopUi';
import type { Product } from '@/services/marketplace/marketplace.types';
import { ShopDialog } from './ShopDialog';
import { unitPrice, useShopActions } from './useShopActions';

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** The product's details in a popup, open to everyone; mounted once in the root layout. */
export default function ProductQuickView() {
  const product = useShopUi((s) => s.quickView);
  const close = useShopUi((s) => s.closeQuickView);
  if (!product) return null;
  // Keyed so another product opens with fresh choices.
  return <QuickViewBody key={product.id} product={product} onClose={close} />;
}

function QuickViewBody({ product, onClose }: { product: Product; onClose: () => void }) {
  const { add, wish, inWishlist, isAdding } = useShopActions();
  const variants = (product.variants ?? []).filter((v) => v.is_active);
  const images = product.images?.length ? product.images : [];
  const [photo, setPhoto] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const stock = variant ? variant.quantity_available : product.quantity_available;
  const outOfStock = stock !== undefined && stock <= 0;
  const price = unitPrice(product, variant);
  const onSale = !!product.sale_price && Number(product.sale_price) < Number(product.price);
  const fullPrice = Number(product.price) + Number(variant?.price_modifier ?? 0);
  const saved = inWishlist(product.id);

  return (
    <ShopDialog labelledBy="quick-view-title" onClose={onClose} className="sm:max-w-4xl">
      <div className="grid sm:grid-cols-2">
        {/* Gallery */}
        <div className="flex flex-col gap-2.5 bg-[#F4F6FA] p-4 pt-14 sm:gap-3 sm:p-7">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#EAEEF4] sm:aspect-square">
            {images.length ? (
              // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
              <img src={images[photo]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-gray-300" aria-hidden>
                <ImageOff className="h-12 w-12" />
              </span>
            )}
            {onSale && (
              <span className="absolute left-3 top-3 rounded bg-[#E03E3E] px-2 py-1 text-[10px] font-bold tracking-wider text-white">SALE</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-4 sm:gap-2.5" role="group" aria-label="Photos">
              {images.slice(0, 8).map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Photo ${i + 1}`}
                  aria-pressed={photo === i}
                  className={cn('aspect-square overflow-hidden rounded-lg border-2 bg-[#EAEEF4]',
                    photo === i ? 'border-[#E03E3E]' : 'border-transparent hover:border-gray-300')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4 p-5 sm:gap-5 sm:p-8">
          <div className="sm:pr-10">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{product.category_name}</p>
            <h2 id="quick-view-title" className="mt-1 text-xl font-bold leading-snug text-gray-900 sm:mt-1.5 sm:text-2xl">{product.name}</h2>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
              <span className={cn('text-xl font-extrabold sm:text-2xl', onSale ? 'text-[#E03E3E]' : 'text-gray-900')}>{naira(price)}</span>
              {onSale && <span className="text-sm text-gray-400 line-through">{naira(fullPrice)}</span>}
              <span className={cn('text-xs font-semibold', outOfStock ? 'text-gray-500' : 'text-emerald-700')}>
                {outOfStock ? 'Out of stock' : 'In stock'}
              </span>
            </div>
          </div>

          {product.description && (
            <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-gray-600 sm:line-clamp-none">{product.description}</p>
          )}

          {variants.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-700">Option</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Option">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={variantId === v.id}
                    className={cn('min-h-10 rounded-lg border-[1.5px] px-3.5 text-sm font-semibold transition-colors',
                      variantId === v.id
                        ? 'border-[#E03E3E] bg-[#FFF1F1] text-[#9B1C1C]'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300')}
                  >
                    {v.variant_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="inline-flex shrink-0 items-center rounded-lg border border-gray-200">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Fewer"
                className="flex h-11 w-9 items-center justify-center text-gray-600 hover:text-gray-900 sm:w-11">
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span aria-live="polite" className="min-w-8 text-center font-bold">{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="More"
                className="flex h-11 w-9 items-center justify-center text-gray-600 hover:text-gray-900 sm:w-11">
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => { add(product, variant, qty); onClose(); }}
              disabled={outOfStock || isAdding}
              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#E03E3E] text-sm font-bold text-white hover:bg-[#c93535] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Add to cart
            </button>
            <button
              type="button"
              onClick={() => wish(product.id)}
              aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
              aria-pressed={saved}
              className={cn('flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg border transition-colors',
                saved ? 'border-[#E03E3E] bg-[#E03E3E] text-white' : 'border-gray-200 text-gray-500 hover:text-[#E03E3E]')}
            >
              <Heart className={cn('h-[18px] w-[18px]', saved && 'fill-current')} aria-hidden />
            </button>
          </div>

          <p className="mt-auto hidden border-t border-gray-100 pt-4 text-xs text-gray-500 sm:block">
            No account needed to add to your basket. Saving to your wishlist and checking out ask you to log in, and your basket comes with you.
          </p>
        </div>
      </div>
    </ShopDialog>
  );
}
