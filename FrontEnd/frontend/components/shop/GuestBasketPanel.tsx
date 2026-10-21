'use client';

import { useEffect, useRef } from 'react';
import { ImageOff, Lock, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useGuestCart, type GuestCartItem } from '@/store/useGuestCart';
import { useShopUi } from '@/store/useShopUi';

const naira = (n: number) => `₦${n.toLocaleString()}`;

/**
 * The guest's basket, before any login: change quantities, remove items, see
 * the total. Only checking out asks for an account; the basket then moves into
 * the real cart (GuestCartSync). Slides in from the right; mounted once in the
 * root layout.
 */
export default function GuestBasketPanel() {
  const open = useShopUi((s) => s.basketOpen);
  const close = useShopUi((s) => s.closeBasket);
  if (!open) return null;
  return <Panel onClose={close} />;
}

function Panel({ onClose }: { onClose: () => void }) {
  const items = useGuestCart((s) => s.items);
  const setQuantity = useGuestCart((s) => s.setQuantity);
  const remove = useGuestCart((s) => s.remove);
  const askToLogIn = useShopUi((s) => s.askToLogIn);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const total = items.reduce((n, i) => n + i.unit_price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-[#11111A]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="basket-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#E03E3E]" aria-hidden />
            <h2 id="basket-title" className="text-lg font-bold text-gray-900">
              Your basket <span className="font-medium text-gray-500">({count})</span>
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <ShoppingBag className="h-10 w-10 text-gray-200" aria-hidden />
            <p className="font-semibold text-gray-700">Your basket is empty.</p>
            <button type="button" onClick={onClose}
              className="min-h-11 text-sm font-semibold text-[#B42318] hover:text-[#7A1A10]">
              Keep shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto px-5">
              {items.map((item) => (
                <BasketLine
                  key={`${item.product_id}-${item.product_variant_id ?? ''}`}
                  item={item}
                  onQuantity={(q) => setQuantity(item.product_id, item.product_variant_id, q)}
                  onRemove={() => remove(item.product_id, item.product_variant_id)}
                />
              ))}
            </ul>

            <footer className="space-y-3 border-t border-gray-100 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-gray-600">Subtotal</span>
                <span className="text-xl font-extrabold text-gray-900">{naira(total)}</span>
              </div>
              <p className="text-xs text-gray-500">Delivery is worked out at checkout. Prices are confirmed when your basket moves to your account.</p>
              <button
                type="button"
                onClick={() => askToLogIn('checkout', '/dashboard/checkout')}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#E03E3E] text-sm font-bold text-white hover:bg-[#c93535]"
              >
                <Lock className="h-4 w-4" aria-hidden />
                Log in to check out
              </button>
              <button type="button" onClick={onClose}
                className="min-h-10 w-full text-sm font-semibold text-[#B42318] hover:text-[#7A1A10]">
                Keep shopping
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function BasketLine({
  item, onQuantity, onRemove,
}: {
  item: GuestCartItem;
  onQuantity: (q: number) => void;
  onRemove: () => void;
}) {
  const atMax = item.max_quantity !== undefined && item.quantity >= item.max_quantity;
  return (
    <li className="flex gap-3.5 py-4">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
        <img src={item.image} alt="" className="h-20 w-20 shrink-0 rounded-lg bg-[#F4F6FA] object-cover" />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[#F4F6FA] text-gray-300" aria-hidden>
          <ImageOff className="h-6 w-6" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
            {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
          </div>
          <button type="button" onClick={onRemove} aria-label={`Remove ${item.name}`}
            className="-mr-2 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="inline-flex items-center rounded-lg border border-gray-200">
            <button type="button" onClick={() => onQuantity(item.quantity - 1)}
              aria-label={item.quantity === 1 ? `Remove ${item.name}` : `One fewer ${item.name}`}
              className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-900">
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span aria-live="polite" className="min-w-7 text-center text-sm font-bold">{item.quantity}</span>
            <button type="button" onClick={() => onQuantity(item.quantity + 1)} disabled={atMax}
              aria-label={`One more ${item.name}`}
              className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <span className="text-sm font-extrabold text-gray-900">{naira(item.unit_price * item.quantity)}</span>
        </div>
        {atMax && <p className="mt-1 text-[11px] text-gray-500">That&rsquo;s all we have in stock.</p>}
      </div>
    </li>
  );
}
