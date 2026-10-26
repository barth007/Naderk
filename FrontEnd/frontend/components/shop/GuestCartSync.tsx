'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useGuestCart } from '@/store/useGuestCart';

/**
 * Moves a guest's basket into their real cart as soon as they are logged in,
 * wherever they land (the cart, checkout, the dashboard). Each item is added
 * through the normal cart API, so the server checks stock and prices it; an
 * item it refuses (sold out, withdrawn) is dropped with a note. Renders nothing.
 */
export default function GuestCartSync() {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || running.current) return;
    const { items, clear } = useGuestCart.getState();
    if (items.length === 0) return;

    running.current = true;
    (async () => {
      const refused: string[] = [];
      for (const item of items) {
        try {
          await apiClient.post('/marketplace/cart/add/', {
            product_id: item.product_id,
            product_variant_id: item.product_variant_id,
            quantity: item.quantity,
          });
        } catch {
          refused.push(item.name);
        }
      }
      clear();
      await queryClient.invalidateQueries({ queryKey: ['marketplace-cart'] });
      const moved = items.length - refused.length;
      if (moved > 0) toast.success(`Your basket is in your cart (${moved} item${moved === 1 ? '' : 's'}).`);
      if (refused.length) {
        toast.error('Some items could not be added', { description: `${refused.join(', ')} — no longer available.` });
      }
      running.current = false;
    })();
  }, [isAuthenticated, queryClient]);

  return null;
}
