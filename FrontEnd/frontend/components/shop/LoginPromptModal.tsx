'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useGuestCart } from '@/store/useGuestCart';
import { useShopUi, type LoginReason } from '@/store/useShopUi';
import { ShopDialog } from './ShopDialog';

const COPY: Record<LoginReason, { title: string; body: string }> = {
  checkout: {
    title: 'Log in to check out',
    body: 'Your basket is saved. Log in or create an account and it moves straight into your cart, then you can finish your order.',
  },
  cart: {
    title: 'Log in to view your cart',
    body: 'Your basket is saved. Log in or create an account and it moves straight into your cart.',
  },
  wishlist: {
    title: 'Log in to save favourites',
    body: 'Your wishlist lives in your account, so you can come back to it on any device.',
  },
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** "Log in to continue", for the wishlist, viewing the cart and checking out. */
export default function LoginPromptModal() {
  const prompt = useShopUi((s) => s.loginPrompt);
  const close = useShopUi((s) => s.closeLoginPrompt);
  const items = useGuestCart((s) => s.items);
  if (!prompt) return null;

  const copy = COPY[prompt.reason];
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const total = items.reduce((n, i) => n + i.unit_price * i.quantity, 0);
  const loginHref = `/login?next=${encodeURIComponent(prompt.next)}`;

  return (
    <ShopDialog labelledBy="login-prompt-title" onClose={close} className="sm:max-w-md">
      <div className="flex flex-col gap-4 p-5 pt-6 sm:gap-5 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F1] text-[#E03E3E] sm:h-12 sm:w-12">
          <Lock className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden />
        </span>
        <div>
          <h2 id="login-prompt-title" className="text-lg font-bold text-gray-900 sm:text-xl">{copy.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{copy.body}</p>
        </div>

        {prompt.reason !== 'wishlist' && count > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-[#F7F7F9] p-3">
            {items[0]?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
              <img src={items[0].image} alt="" className="h-11 w-11 rounded-lg object-cover" />
            ) : (
              <span className="h-11 w-11 rounded-lg bg-[#EAEEF4]" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{count} item{count === 1 ? '' : 's'} in your basket</p>
              <p className="text-xs text-gray-500">{naira(total)}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <Link href={loginHref} onClick={close}
            className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-[#E03E3E] text-sm font-bold text-white hover:bg-[#c93535]">
            Log in
          </Link>
          <Link href="/register" onClick={close}
            className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-gray-200 text-sm font-semibold text-gray-900 hover:bg-gray-50">
            Create an account
          </Link>
          <button type="button" onClick={close}
            className="min-h-10 text-sm font-semibold text-[#B42318] hover:text-[#7A1A10]">
            Keep shopping
          </button>
        </div>
      </div>
    </ShopDialog>
  );
}
