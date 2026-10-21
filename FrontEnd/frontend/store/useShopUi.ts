import { create } from 'zustand';
import type { Product } from '@/services/marketplace/marketplace.types';

/**
 * Which shop popups are open on the public site: the product quick view and
 * the "log in to continue" prompt. Kept in a store so any part of the page
 * (the home shop, the basket strip's wishlist list) can open them, while each
 * popup is mounted once in the root layout.
 */

export type LoginReason = 'checkout' | 'cart' | 'wishlist';

interface ShopUiState {
  quickView: Product | null;
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;

  /** The guest basket panel, opened from the basket strip's "View cart". */
  basketOpen: boolean;
  openBasket: () => void;
  closeBasket: () => void;

  /** Set while the login prompt is showing: why, and where to return after logging in. */
  loginPrompt: { reason: LoginReason; next: string } | null;
  askToLogIn: (reason: LoginReason, next: string) => void;
  closeLoginPrompt: () => void;
}

export const useShopUi = create<ShopUiState>()((set) => ({
  quickView: null,
  openQuickView: (product) => set({ quickView: product }),
  closeQuickView: () => set({ quickView: null }),

  basketOpen: false,
  openBasket: () => set({ basketOpen: true }),
  closeBasket: () => set({ basketOpen: false }),

  loginPrompt: null,
  // The prompt replaces any other shop popup rather than stacking on it.
  askToLogIn: (reason, next) => set({ loginPrompt: { reason, next }, quickView: null, basketOpen: false }),
  closeLoginPrompt: () => set({ loginPrompt: null }),
}));
