'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Glasses, MapPin, CreditCard,
  Loader2, CheckCircle2, Clock, Truck, AlertCircle,
  Receipt, ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { useOrder } from '@/services/marketplace/marketplace.hooks';
import { Order } from '@/services/marketplace/marketplace.types';
import { cn } from '@/lib/cn';
import { format, parseISO } from 'date-fns';

// ── Timeline ──────────────────────────────────────────────────────────────────

const TIMELINE: Array<{ key: Order['status']; label: string; description: string }> = [
  { key: 'PENDING',          label: 'Order Placed',      description: 'We received your order.' },
  { key: 'PAID',             label: 'Payment Confirmed', description: 'Your payment was verified.' },
  { key: 'FRAME_RESERVED',   label: 'Frame Reserved',    description: 'Your frame has been set aside.' },
  { key: 'IN_PRODUCTION',    label: 'In Production',     description: 'Our team has started working on your order.' },
  { key: 'LENS_CUTTING',     label: 'Lens Cutting',      description: 'Lenses are being cut to prescription.' },
  { key: 'FRAME_ASSEMBLY',   label: 'Assembly',          description: 'Lenses are being fitted to the frame.' },
  { key: 'QUALITY_CHECK',    label: 'Quality Check',     description: 'Final inspection in progress.' },
  { key: 'READY_FOR_PICKUP', label: 'Ready',             description: 'Your order is ready.' },
  { key: 'SHIPPED',          label: 'Shipped',           description: 'Your order is on its way.' },
  { key: 'DELIVERED',        label: 'Delivered',         description: 'Order delivered successfully.' },
];

const STATUS_ORDER = TIMELINE.map(s => s.key);

// ── Payment badge ─────────────────────────────────────────────────────────────

function PaymentBadge({ status }: { status: Order['payment_status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    PAID:                { label: 'Paid',              cls: 'bg-green-50 text-green-700 border-green-200' },
    UNPAID:              { label: 'Unpaid',            cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    PENDING_PAYMENT:     { label: 'Pending',           cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    FAILED:              { label: 'Payment Failed',    cls: 'bg-red-50 text-red-600 border-red-200' },
    REFUNDED:            { label: 'Refunded',          cls: 'bg-gray-50 text-gray-500 border-gray-200' },
    PARTIALLY_REFUNDED:  { label: 'Partial Refund',   cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  return (
    <span className={cn('text-[10px] font-bold border px-2 py-0.5 rounded-sm', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────

function OrderItemRow({ item }: { item: Order['items'][0] }) {
  const img = item.frame_detail?.front_image ?? item.product_detail?.images?.[0];
  const name = item.frame_detail
    ? `${item.frame_detail.brand} ${item.frame_detail.name}`
    : item.product_detail?.name ?? 'Item';
  const variant = item.frame_variant_detail
    ? `${item.frame_variant_detail.color}`
    : null;
  const lineTotal = parseFloat(item.price) * item.quantity;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-50 last:border-0">
      <div className="w-14 h-14 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
        {img
          ? <img src={img} alt={name} className="w-full h-full object-cover" />
          : item.frame_variant
            ? <Glasses className="w-5 h-5 text-gray-300" />
            : <Package className="w-5 h-5 text-gray-300" />}
      </div>
      <div className="flex-grow min-w-0">
        <p className="text-sm font-bold text-gray-900">{name}</p>
        {variant && <p className="text-xs text-gray-400 mt-0.5">Colour: {variant}</p>}
        {item.lens_type_detail && <p className="text-xs text-gray-400">Lens: {item.lens_type_detail.name}</p>}
        <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity} × ₦{parseFloat(item.price).toLocaleString()}</p>
      </div>
      <p className="text-sm font-extrabold text-gray-900 shrink-0">₦{lineTotal.toLocaleString()}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useOrder(id);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#ff052f] animate-spin" />
        <p className="text-sm text-gray-400 font-semibold">Loading order…</p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center p-8">
        <AlertCircle className="w-10 h-10 text-gray-300" />
        <p className="font-bold text-gray-700">Order not found.</p>
        <Button onClick={() => router.push('/dashboard/orders')} variant="outline" className="rounded-full">
          Back to Orders
        </Button>
      </div>
    );
  }

  const stepIdx    = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const hasFrames   = order.items.some(i => !!i.frame_variant);

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 animate-in fade-in duration-300">

      {/* Breadcrumb */}
      <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6"><Breadcrumbs /></div>

      {/* Back + header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/orders')}
          className="rounded-full w-9 h-9 border-gray-200 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-gray-400 font-semibold mt-0.5">
            Placed {format(parseISO(order.created_at), 'MMMM d, yyyy · h:mm a')}
          </p>
        </div>
        <div className="ml-auto"><PaymentBadge status={order.payment_status} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left: items + timeline */}
        <div className="lg:col-span-2 space-y-6">

          {/* Order items */}
          <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#ff052f]" />
              <h2 className="text-sm font-extrabold text-gray-900">Items ({order.items.length})</h2>
            </div>
            {order.items.map(item => <OrderItemRow key={item.id} item={item} />)}
          </Card>

          {/* Production timeline */}
          {hasFrames && !isCancelled && (
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Truck className="w-4 h-4 text-[#ff052f]" />
                <h2 className="text-sm font-extrabold text-gray-900">Order Progress</h2>
              </div>
              <div className="space-y-0">
                {TIMELINE.map((step, idx) => {
                  const done    = stepIdx >= idx;
                  const current = stepIdx === idx;
                  return (
                    <div key={step.key} className="flex gap-3">
                      {/* Dot + line */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-3 h-3 rounded-full shrink-0 mt-1 transition',
                          done
                            ? current ? 'bg-[#ff052f] ring-4 ring-[#ff052f]/15' : 'bg-green-500'
                            : 'bg-gray-200'
                        )} />
                        {idx < TIMELINE.length - 1 && (
                          <div className={cn('w-px flex-1 my-1', idx < stepIdx ? 'bg-green-300' : 'bg-gray-100')} style={{ minHeight: 20 }} />
                        )}
                      </div>
                      {/* Label */}
                      <div className="pb-4">
                        <p className={cn('text-xs font-bold', done ? current ? 'text-[#ff052f]' : 'text-gray-900' : 'text-gray-400')}>
                          {step.label}
                        </p>
                        {current && (
                          <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{step.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <Card className="bg-red-50 border border-red-100 rounded-md p-5 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Order Cancelled</p>
                <p className="text-xs text-red-500 mt-0.5">This order has been cancelled. If you were charged, a refund will be processed within 5–7 business days.</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right: summary + address + payment */}
        <div className="space-y-4">

          {/* Order summary */}
          <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 space-y-3">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500 font-semibold">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">₦{parseFloat(order.total_price).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-semibold">
                <span>Shipping</span>
                <span className="text-gray-400 italic">Calculated separately</span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-xs font-extrabold text-gray-900">Total</span>
              <span className="text-lg font-black text-[#ff052f]">₦{parseFloat(order.total_price).toLocaleString()}</span>
            </div>
          </Card>

          {/* Shipping address */}
          {order.shipping_address && (
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#ff052f]" />
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Ship To</h3>
              </div>
              <p className="text-xs text-gray-600 font-semibold leading-relaxed">{order.shipping_address}</p>
            </Card>
          )}

          {/* Payment info */}
          <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-[#ff052f]" />
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Payment</h3>
            </div>
            <div className="flex items-center gap-2">
              <PaymentBadge status={order.payment_status} />
            </div>
            {order.payment_reference && (
              <p className="text-[10px] text-gray-400 font-mono break-all">Ref: {order.payment_reference}</p>
            )}
          </Card>

          {/* Status */}
          <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-[#ff052f]" />
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Status</h3>
            </div>
            <p className="text-xs font-bold text-gray-900">{order.status_display}</p>
          </Card>

          <Button
            onClick={() => router.push('/dashboard/marketplace')}
            className="w-full bg-[#ff052f] hover:bg-[#d90022] text-white font-bold rounded-md text-xs">
            Continue Shopping
          </Button>
        </div>

      </div>
    </div>
  );
}
