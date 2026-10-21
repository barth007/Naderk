'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Lock, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { useGuestCart } from '@/store/useGuestCart';
import { useShopUi } from '@/store/useShopUi';
import { useCart, useWishlist } from '@/services/marketplace/marketplace.hooks';

const naira = (n: number) => `₦${n.toLocaleString()}`;
const noSubscribe = () => () => {};

/**
 * The slim bar above the navbar on the public site. Hidden until something is
 * in the basket (or, signed in, saved to the wishlist). A guest's basket comes
 * from this browser; a signed-in shopper's from their cart. Viewing the cart
 * and checking out ask a guest to log in first.
 */
export default function BasketStrip() {
  const router = useRouter();
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const guestItems = useGuestCart((s) => s.items);
  const askToLogIn = useShopUi((s) => s.askToLogIn);
  const { data: cart } = useCart(isAuthenticated);
  const { data: wishlist } = useWishlist(isAuthenticated);

  // The guest basket is read from this browser's storage, which the server
  // render cannot see: show nothing until mounted so the two renders agree.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!mounted) return null;

  const count = isAuthenticated
    ? (cart?.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0)
    : guestItems.reduce((n, i) => n + i.quantity, 0);
  const total = isAuthenticated
    ? Number(cart?.total_price ?? 0)
    : guestItems.reduce((n, i) => n + i.unit_price * i.quantity, 0);
  const saved = isAuthenticated ? (wishlist?.items ?? []).filter((w) => w.product_detail) : [];

  if (count === 0 && saved.length === 0) return null;

  const go = (path: string, reason: 'cart' | 'checkout') => {
    if (isAuthenticated) router.push(path);
    else askToLogIn(reason, path);
  };

  return (
    <div className="bg-[#1A1A2E] text-white">
      <div className="mx-auto flex min-h-11 w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-1.5 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2.5 text-[13px]">
          <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">Your basket</span>
          <span className="text-[#C9C9D6]">
            {count} item{count === 1 ? '' : 's'}{count > 0 && ` · ${naira(total)}`}
          </span>
        </p>
        <div className="flex items-center gap-2 text-[13px]">
          {saved.length > 0 && <WishlistMenu items={saved} />}
          {count > 0 && (
            <>
              <button type="button" onClick={() => go('/dashboard/cart', 'cart')}
                className="inline-flex min-h-8 items-center rounded-full border border-white/25 px-3 hover:bg-white/10">
                View cart
              </button>
              <button type="button" onClick={() => go('/dashboard/checkout', 'checkout')}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#E03E3E] px-3.5 font-semibold hover:bg-[#c93535]">
                {!isAuthenticated && <Lock className="h-3.5 w-3.5" aria-hidden />}
                Checkout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Saved = NonNullable<ReturnType<typeof useWishlist>['data']>['items'][number];

/** The signed-in shopper's wishlist, as a small list; each item opens its quick view. */
function WishlistMenu({ items }: { items: Saved[] }) {
  const openQuickView = useShopUi((s) => s.openQuickView);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/25 px-3 hover:bg-white/10', open && 'bg-white/10')}>
        <Heart className="h-3.5 w-3.5" aria-hidden />
        Wishlist ({items.length})
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-gray-100 bg-white text-gray-900 shadow-xl">
          <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500">Saved for later</p>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((w) => {
              const p = w.product_detail!;
              return (
                <li key={w.id}>
                  <button type="button" onClick={() => { setOpen(false); openQuickView(p); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
                      <img src={p.images[0]} alt="" className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <span className="h-10 w-10 rounded-md bg-gray-100" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-gray-500">{naira(Number(p.sale_price ?? p.price))}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
