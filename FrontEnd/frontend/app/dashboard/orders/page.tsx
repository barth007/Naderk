'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Package, CheckCircle2, Clock, Truck,
  Loader2, ShoppingBag, ChevronRight, Glasses,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { toast } from 'sonner';
import { useOrders } from '@/services/marketplace/marketplace.hooks';
import { Order } from '@/services/marketplace/marketplace.types';
import { cn } from '@/lib/cn';
import { format, parseISO } from 'date-fns';

// ── Status helpers ────────────────────────────────────────────────────────────

type StatusLevel = 'pending' | 'active' | 'complete' | 'cancelled';

function statusLevel(status: Order['status']): StatusLevel {
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'DELIVERED') return 'complete';
  if (['PENDING', 'PRESCRIPTION_REVIEW'].includes(status)) return 'pending';
  return 'active';
}

const STATUS_CONFIG: Record<StatusLevel, { dot: string; badge: string }> = {
  pending:   { dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  active:    { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  complete:  { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { dot: 'bg-gray-300',   badge: 'bg-gray-50 text-gray-500 border-gray-200' },
};

type PayLevel = 'unpaid' | 'paid' | 'failed';
function payLevel(ps: Order['payment_status']): PayLevel {
  if (ps === 'PAID') return 'paid';
  if (['FAILED', 'REFUNDED'].includes(ps)) return 'failed';
  return 'unpaid';
}
const PAY_CONFIG: Record<PayLevel, string> = {
  unpaid: 'text-yellow-600',
  paid:   'text-green-600',
  failed: 'text-red-500',
};

// ── Production timeline steps ─────────────────────────────────────────────────
const TIMELINE_STEPS: Array<{ key: Order['status']; label: string }> = [
  { key: 'PENDING',          label: 'Order Placed' },
  { key: 'PAID',                label: 'Payment Confirmed' },
  { key: 'PRESCRIPTION_REVIEW', label: 'Prescription Review' },
  { key: 'FRAME_RESERVED',      label: 'Frame Reserved' },
  { key: 'IN_PRODUCTION',    label: 'In Production' },
  { key: 'LENS_CUTTING',     label: 'Lens Cutting' },
  { key: 'FRAME_ASSEMBLY',   label: 'Assembly' },
  { key: 'QUALITY_CHECK',    label: 'Quality Check' },
  { key: 'READY_FOR_PICKUP', label: 'Ready' },
  { key: 'SHIPPED',          label: 'Shipped' },
  { key: 'DELIVERED',        label: 'Delivered' },
];

const STATUS_ORDER = TIMELINE_STEPS.map(s => s.key);

function OrderCard({ order, isNew }: { order: Order; isNew: boolean }) {
  const router = useRouter();
  const level = statusLevel(order.status);
  const cfg = STATUS_CONFIG[level];
  const stepIdx = STATUS_ORDER.indexOf(order.status);
  const hasFrames = order.items.some(i => !!i.frame_variant);

  return (
    <Card
      className={cn(
        "bg-white border rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden transition",
        isNew ? "border-[#ff052f] ring-2 ring-[#ff052f]/10" : "border-gray-100"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
          <div>
            <p className="text-xs font-extrabold text-gray-900">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold">
              {format(parseISO(order.created_at), 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold border px-2 py-0.5 rounded-sm", cfg.badge)}>
            {order.status_display}
          </span>
          <button
            onClick={() => router.push(`/dashboard/orders/${order.id}`)}
            className="p-1 text-gray-300 hover:text-[#ff052f] transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items preview */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="flex -space-x-2">
          {order.items.slice(0, 3).map(item => {
            const img = item.frame_detail?.front_image ?? item.product_detail?.images?.[0];
            return (
              <div key={item.id} className="w-8 h-8 rounded-md border-2 border-white bg-gray-50 overflow-hidden shrink-0">
                {img
                  ? <img src={img} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      {item.frame_variant ? <Glasses className="w-3 h-3 text-gray-300" /> : <Package className="w-3 h-3 text-gray-300" />}
                    </div>
                }
              </div>
            );
          })}
          {order.items.length > 3 && (
            <div className="w-8 h-8 rounded-md border-2 border-white bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400">
              +{order.items.length - 3}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700 truncate">
            {order.items.map(i =>
              i.frame_detail ? `${i.frame_detail.brand} ${i.frame_detail.name}` : i.product_detail?.name ?? 'Item'
            ).join(', ')}
          </p>
          <p className={cn("text-[10px] font-bold mt-0.5", PAY_CONFIG[payLevel(order.payment_status)])}>
            {order.payment_status_display} · ₦{parseFloat(order.total_price).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Production timeline (only for orders with frames) */}
      {hasFrames && level !== 'cancelled' && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-0">
            {TIMELINE_STEPS.map((step, idx) => {
              const done = stepIdx >= idx;
              const current = stepIdx === idx;
              return (
                <React.Fragment key={step.key}>
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0 transition",
                      done ? (current ? "bg-[#ff052f] ring-2 ring-[#ff052f]/20" : "bg-green-500") : "bg-gray-200"
                    )}
                    title={step.label}
                  />
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div className={cn("h-px flex-1 transition", idx < stepIdx ? "bg-green-400" : "bg-gray-100")} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <p className="text-[9px] text-gray-400 font-semibold mt-1.5">
            {TIMELINE_STEPS[stepIdx]?.label ?? order.status_display}
          </p>
        </div>
      )}
    </Card>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOrderId = searchParams.get('new');
  const { data: orders = [], isLoading } = useOrders();

  useEffect(() => {
    if (newOrderId) {
      toast.success('Your order has been placed! We\'ll be in touch shortly.', { duration: 5000 });
    }
  }, [newOrderId]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#ff052f] animate-spin" />
        <p className="text-sm text-gray-400 font-semibold">Loading your orders…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6">
        <Breadcrumbs />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button
          variant="outline" size="icon"
          onClick={() => router.push('/dashboard/marketplace')}
          className="rounded-full w-9 h-9 border-gray-200 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Your Orders</h1>
          <p className="text-sm text-gray-400 font-semibold mt-0.5">
            {orders.length === 0 ? 'No orders yet' : `${orders.length} order${orders.length !== 1 ? 's' : ''} placed`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            {
              label: 'Total Spent',
              value: `₦${orders.reduce((s, o) => s + parseFloat(o.total_price), 0).toLocaleString()}`,
              icon: <ShoppingBag className="w-4 h-4 text-[#ff052f]" />,
            },
            {
              label: 'Active Orders',
              value: orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length,
              icon: <Truck className="w-4 h-4 text-blue-500" />,
            },
            {
              label: 'Completed',
              value: orders.filter(o => o.status === 'DELIVERED').length,
              icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
            },
          ].map(stat => (
            <Card key={stat.label} className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span></div>
              <p className="text-lg font-black text-gray-900">{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-dashed border-gray-200">
          <Clock className="w-12 h-12 text-gray-200" />
          <div className="text-center">
            <p className="font-bold text-gray-700">No orders yet</p>
            <p className="text-sm text-gray-400 mt-1">Your orders will appear here once you checkout.</p>
          </div>
          <Link
            href="/dashboard/marketplace"
            className="inline-flex items-center gap-2 bg-[#ff052f] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#d90022] transition"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Shop Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              isNew={order.id === newOrderId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
