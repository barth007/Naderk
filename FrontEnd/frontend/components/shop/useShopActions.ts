'use client';

import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useGuestCart } from '@/store/useGuestCart';
import { useShopUi } from '@/store/useShopUi';
import {
  useAddToCart, useToggleWishlist, useWishlist,
} from '@/services/marketplace/marketplace.hooks';
import type { Product, ProductVariant } from '@/services/marketplace/marketplace.types';

/** What one unit costs: the sale price if a flash sale is on, plus the option's modifier. */
export function unitPrice(product: Product, variant?: ProductVariant | null) {
  const base = Number(product.sale_price ?? product.price);
  return base + Number(variant?.price_modifier ?? 0);
}

/**
 * The public site's shop actions, with the account rules in one place:
 * browsing and adding to the basket need no account; the wishlist does.
 * (Viewing the cart and checking out go through the basket strip, which asks
 * for a login the same way.)
 */
export function useShopActions() {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const guestAdd = useGuestCart((s) => s.add);
  const askToLogIn = useShopUi((s) => s.askToLogIn);
  const { data: wishlist } = useWishlist(isAuthenticated);
  const addToCart = useAddToCart();
  const toggleWishlist = useToggleWishlist();

  const inWishlist = (productId: string) =>
    !!isAuthenticated && (wishlist?.items?.some((w) => w.product === productId) ?? false);

  const add = (product: Product, variant: ProductVariant | null = null, quantity = 1) => {
    if (!isAuthenticated) {
      guestAdd({
        product_id: product.id,
        product_variant_id: variant?.id ?? null,
        quantity,
        name: product.name,
        variant_name: variant?.variant_name,
        image: product.images?.[0],
        unit_price: unitPrice(product, variant),
      });
      toast.success(`${product.name} added to your basket`);
      return;
    }
    addToCart.mutate(
      { product_id: product.id, product_variant_id: variant?.id ?? null, quantity },
      {
        onSuccess: () => toast.success(`${product.name} added to cart`),
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.error(detail ?? 'Could not add item to cart.');
        },
      },
    );
  };

  const wish = (productId: string) => {
    if (!isAuthenticated) {
      askToLogIn('wishlist', window.location.pathname + window.location.search);
      return;
    }
    const wasSaved = inWishlist(productId);
    toggleWishlist.mutate({ product_id: productId }, {
      onSuccess: () => toast.success(wasSaved ? 'Removed from wishlist' : 'Added to wishlist'),
      onError: () => toast.error('Could not update your wishlist.'),
    });
  };

  return { isAuthenticated, add, wish, inWishlist, isAdding: addToCart.isPending };
}
