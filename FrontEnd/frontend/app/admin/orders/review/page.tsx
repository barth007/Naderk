'use client';

import React, { useState } from 'react';
import { ClipboardList, CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useOrderReviewQueue, useReviewOrder } from '@/services/marketplace/marketplace.hooks';
import { Order } from '@/services/marketplace/marketplace.types';
import { format, parseISO } from 'date-fns';

function PrescriptionSummary({ order }: { order: Order }) {
  const rxItems = order.items.filter(i => i.prescription_snapshot);
  if (!rxItems.length) return <span className="text-gray-400 text-xs">No Rx data</span>;
  return (
    <div className="space-y-1">
      {rxItems.map(item => {
        const rx = item.prescription_snapshot;
        return (
          <div key={item.id} className="text-xs text-gray-600">
            <span className="font-medium">{item.lens_type_detail?.name ?? 'Lens'}</span>
            {rx && (
              <span className="ml-1 text-gray-400">
                R: {rx.right_sph ?? '—'}/{rx.right_cyl ?? '—'} | L: {rx.left_sph ?? '—'}/{rx.left_cyl ?? '—'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewRow({ order, onAction }: { order: Order; onAction: (orderId: string, action: 'approve' | 'reject', notes: string) => void }) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  function handleConfirm() {
    if (!pendingAction) return;
    onAction(order.id, pendingAction, notes);
    setPendingAction(null);
    setNotes('');
    setShowNotes(false);
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-4">
        <p className="text-xs font-mono text-gray-500">#{order.id.slice(0, 8).toUpperCase()}</p>
        <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(order.created_at), 'dd MMM yyyy, HH:mm')}</p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-medium text-gray-900">
          {(order as any).user_email ?? order.user}
        </p>
      </td>
      <td className="px-4 py-4">
        <PrescriptionSummary order={order} />
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-gray-900">
        ₦{Number(order.total_price).toLocaleString()}
      </td>
      <td className="px-4 py-4">
        {showNotes ? (
          <div className="flex flex-col gap-2 min-w-[220px]">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={pendingAction === 'reject' ? 'Reason for rejection (optional)' : 'Approval notes (optional)'}
              rows={2}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg text-white transition-colors ${
                  pendingAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm {pendingAction === 'approve' ? 'Approval' : 'Rejection'}
              </button>
              <button
                onClick={() => { setShowNotes(false); setPendingAction(null); setNotes(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setPendingAction('approve'); setShowNotes(true); }}
              className="flex items-center gap-1 text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => { setPendingAction('reject'); setShowNotes(true); }}
              className="flex items-center gap-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function OrderPrescriptionReviewPage() {
  const { data: orders, isLoading, isError } = useOrderReviewQueue();
  const reviewMutation = useReviewOrder();

  function handleAction(orderId: string, action: 'approve' | 'reject', notes: string) {
    reviewMutation.mutate(
      { orderId, action, notes },
      {
        onSuccess: () => {
          toast.success(action === 'approve' ? 'Order approved — frame reservation started.' : 'Order rejected and cancelled.');
        },
        onError: () => {
          toast.error('Action failed. Please try again.');
        },
      }
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Prescription Review Queue</h1>
          <p className="text-sm text-gray-500">Orders awaiting clinical prescription review before production</p>
        </div>
        {orders && orders.length > 0 && (
          <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full border border-yellow-200">
            {orders.length} pending
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading queue…
        </div>
      )}

      {isError && (
        <div className="text-center py-16 text-red-500 text-sm">Failed to load review queue.</div>
      )}

      {!isLoading && !isError && orders?.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">All clear — no prescriptions awaiting review.</p>
        </div>
      )}

      {!isLoading && !isError && orders && orders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prescription</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <ReviewRow key={order.id} order={order} onAction={handleAction} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
