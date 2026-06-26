'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Trash2, Plus, Minus, ArrowLeft,
  Package, Glasses, Loader2, ShoppingBag, Tag,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { toast } from 'sonner';
import {
  useCart, useUpdateCartQuantity, useRemoveFromCart, useClearCart,
} from '@/services/marketplace/marketplace.hooks';
import { CartItem } from '@/services/marketplace/marketplace.types';
import { cn } from '@/lib/cn';

function itemLabel(item: CartItem): string {
  if (item.frame_variant_detail && item.frame_detail) {
    return `${item.frame_detail.brand} ${item.frame_detail.name} — ${item.frame_variant_detail.color} / ${item.frame_variant_detail.size}`;
  }
  if (item.product_detail) return item.product_detail.name;
  return 'Item';
}

function itemSubtitle(item: CartItem): string {
  const parts: string[] = [];
  if (item.lens_type_detail) parts.push(item.lens_type_detail.name);
  if (item.lens_options_detail?.length) parts.push(item.lens_options_detail.map(o => o.name).join(', '));
  if (item.prescription_detail) parts.push('Prescription included');
  return parts.join(' · ');
}

function itemImage(item: CartItem): string | undefined {
  if (item.frame_detail?.front_image) return item.frame_detail.front_image;
  if (item.product_detail?.images?.[0]) return item.product_detail.images[0];
  return undefined;
}

function ItemIcon({ item }: { item: CartItem }) {
  if (item.frame_variant) return <Glasses className="w-5 h-5 text-gray-400" />;
  return <Package className="w-5 h-5 text-gray-400" />;
}

export default function CartPage() {
  const router = useRouter();
  const { data: cart, isLoading } = useCart();
  const updateQtyMutation = useUpdateCartQuantity();
  const removeMutation = useRemoveFromCart();
  const clearMutation = useClearCart();

  const handleQty = (itemId: string, current: number, delta: number) => {
    const next = current + delta;
    if (next < 1) {
      removeMutation.mutate(itemId, {
        onSuccess: () => toast.success('Item removed'),
        onError: () => toast.error('Could not remove item'),
      });
    } else {
      updateQtyMutation.mutate({ item_id: itemId, quantity: next }, {
        onError: () => toast.error('Could not update quantity'),
      });
    }
  };

  const handleRemove = (itemId: string) => {
    removeMutation.mutate(itemId, {
      onSuccess: () => toast.success('Item removed from cart'),
      onError: () => toast.error('Could not remove item'),
    });
  };

  const handleClear = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => toast.success('Cart cleared'),
      onError: () => toast.error('Could not clear cart'),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#ff052f] animate-spin" />
        <p className="text-sm text-gray-400 font-semibold">Loading your cart…</p>
      </div>
    );
  }

  const items = cart?.items ?? [];
  const isEmpty = items.length === 0;

  return (
    <div className="w-full max-w-5xl mx-auto pb-20">
      {/* Breadcrumb */}
      <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6">
        <Breadcrumbs />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/marketplace')}
            className="rounded-full w-9 h-9 border-gray-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Your Cart</h1>
            <p className="text-sm text-gray-400 font-semibold mt-0.5">
              {isEmpty ? 'No items yet' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {!isEmpty && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearMutation.isPending}
            className="text-red-500 border-red-200 hover:bg-red-50 rounded-md text-xs"
          >
            {clearMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            Clear Cart
          </Button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-dashed border-gray-200">
          <ShoppingBag className="w-12 h-12 text-gray-200" />
          <div className="text-center">
            <p className="font-bold text-gray-700">Your cart is empty</p>
            <p className="text-sm text-gray-400 mt-1">Browse the marketplace to add items.</p>
          </div>
          <Link
            href="/dashboard/marketplace"
            className="mt-2 inline-flex items-center gap-2 bg-[#ff052f] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#d90022] transition"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Go to Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Items list */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(item => {
              const img = itemImage(item);
              const label = itemLabel(item);
              const subtitle = itemSubtitle(item);
              const lineTotal = parseFloat(item.price) * item.quantity;
              const isBusy = (updateQtyMutation.isPending || removeMutation.isPending);

              return (
                <Card
                  key={item.id}
                  className="bg-white border border-gray-100 rounded-md shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  <div className="flex items-start gap-4 p-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-md bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
                      {img ? (
                        <img src={img} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <ItemIcon item={item} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-grow min-w-0">
                      <p className="text-xs font-extrabold text-gray-900 leading-snug">{label}</p>
                      {subtitle && (
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{subtitle}</p>
                      )}
                      {item.prescription_detail && (
                        <span className="inline-block mt-1 text-[9px] font-bold bg-green-50 text-green-600 px-2 py-0.5 rounded-sm">
                          RX Attached
                        </span>
                      )}
                      <p className="text-xs font-extrabold text-[#ff052f] mt-1.5">
                        ₦{lineTotal.toLocaleString()}
                        {item.quantity > 1 && (
                          <span className="text-[10px] text-gray-400 font-semibold ml-1">
                            (₦{parseFloat(item.price).toLocaleString()} × {item.quantity})
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={isBusy}
                        className="p-1 text-gray-300 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5 border border-gray-200 rounded-md overflow-hidden">
                        <button
                          onClick={() => handleQty(item.id, item.quantity, -1)}
                          disabled={isBusy}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-gray-900 w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleQty(item.id, item.quantity, 1)}
                          disabled={isBusy}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="space-y-4">
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Order Summary</h3>

              <div className="space-y-2.5">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-gray-500 font-semibold truncate max-w-[160px]">{itemLabel(item)}</span>
                    <span className="font-bold text-gray-900 shrink-0 ml-2">
                      ₦{(parseFloat(item.price) * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="text-xs font-extrabold text-gray-900">Total</span>
                <span className="text-lg font-black text-[#ff052f]">
                  ₦{(cart?.total_price ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-md p-3 flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-500 font-semibold">
                  Delivery fees and taxes calculated at checkout.
                </p>
              </div>

              <Button
                className="w-full bg-[#ff052f] hover:bg-[#d90022] text-white font-bold rounded-md"
                onClick={() => router.push('/dashboard/checkout')}
              >
                Proceed to Checkout
              </Button>

              <Link
                href="/dashboard/marketplace"
                className="block text-center text-xs text-gray-400 font-semibold hover:text-[#ff052f] transition"
              >
                ← Continue Shopping
              </Link>
            </Card>

            {/* Orders link */}
            <Link
              href="/dashboard/orders"
              className="block text-center text-[10px] text-gray-400 font-semibold hover:text-[#ff052f] transition"
            >
              View your order history →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
