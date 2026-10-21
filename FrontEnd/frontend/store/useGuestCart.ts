import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * A cart for visitors who have not logged in, kept in this browser.
 *
 * Only what is needed to show the basket strip and to recreate the items in the
 * real cart is stored; the server prices everything again when the items are
 * moved over after login (see GuestCartSync), so the stored price is display
 * only.
 */
export interface GuestCartItem {
  product_id: string;
  product_variant_id: string | null;
  quantity: number;
  name: string;
  variant_name?: string;
  image?: string;
  unit_price: number;
  /** Stock when it was added, to cap the quantity; the server checks again at login. */
  max_quantity?: number;
}

interface GuestCartState {
  items: GuestCartItem[];
  add: (item: GuestCartItem) => void;
  remove: (productId: string, variantId: string | null) => void;
  /** Set an item's quantity; below 1 removes it. */
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  clear: () => void;
}

const same = (a: GuestCartItem, productId: string, variantId: string | null) =>
  a.product_id === productId && (a.product_variant_id ?? null) === (variantId ?? null);

export const useGuestCart = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((state) => {
        const existing = state.items.find((i) => same(i, item.product_id, item.product_variant_id));
        if (!existing) return { items: [...state.items, item] };
        return {
          items: state.items.map((i) => (i === existing
            ? {
              ...i,
              quantity: Math.min(i.quantity + item.quantity, item.max_quantity ?? Infinity),
              unit_price: item.unit_price,
              max_quantity: item.max_quantity,
            }
            : i)),
        };
      }),
      remove: (productId, variantId) => set((state) => ({
        items: state.items.filter((i) => !same(i, productId, variantId)),
      })),
      setQuantity: (productId, variantId, quantity) => set((state) => ({
        items: quantity < 1
          ? state.items.filter((i) => !same(i, productId, variantId))
          : state.items.map((i) => (same(i, productId, variantId) ? { ...i, quantity } : i)),
      })),
      clear: () => set({ items: [] }),
    }),
    { name: 'naderk-guest-cart' },
  ),
);
