'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Package, CheckCircle2, Truck, Clock,
  Search, Filter, X, Eye, RotateCcw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, Th, Td,
} from '@/components/ui/table';
import { useAdminAllOrders, AdminOrder } from '@/services/admin/admin-inventory.hooks';
import { Pagination } from '@/components/ui/pagination';

// ─── Status Config ─────────────────────────────────────────────────────────────

const REVIEW_STATUSES = ['PAID', 'PRESCRIPTION_REVIEW', 'FRAME_RESERVED', 'IN_PRODUCTION', 'FRAME_ASSEMBLY'];
const SHIPPED_STATUSES = ['READY_FOR_PICKUP', 'SHIPPED'];

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PAID:                { label: 'Paid',                color: 'text-blue-700',   bg: 'bg-blue-50',   dot: 'bg-blue-500' },
  PRESCRIPTION_REVIEW: { label: 'Rx Review',           color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  FRAME_RESERVED:      { label: 'Frame Reserved',      color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  IN_PRODUCTION:       { label: 'In Production',       color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  FRAME_ASSEMBLY:      { label: 'Frame Assembly',      color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-500' },
  READY_FOR_PICKUP:    { label: 'Ready for Pickup',    color: 'text-green-700',  bg: 'bg-green-50',  dot: 'bg-green-500' },
  SHIPPED:             { label: 'Shipped',             color: 'text-teal-700',   bg: 'bg-teal-50',   dot: 'bg-teal-500' },
  DELIVERED:           { label: 'Delivered',           color: 'text-gray-700',   bg: 'bg-gray-100',  dot: 'bg-gray-400' },
  CANCELLED:           { label: 'Cancelled',           color: 'text-red-700',    bg: 'bg-red-50',    dot: 'bg-red-500' },
  PROCESSING:          { label: 'Processing',          color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-400' },
  PENDING:             { label: 'Pending',             color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-400' },
};

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-50', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${meta.bg} ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function OrderDetailModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Order #{order.id.replace(/-/g, '').slice(0, 8).toUpperCase()}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Customer</span>
            <span className="text-xs font-semibold text-gray-800">{order.customer_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-xs font-semibold text-gray-800">₦{parseFloat(order.total_price).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Ordered</span>
            <span className="text-xs text-gray-600">{format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}</span>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">First Item</p>
            <div className="flex items-center gap-3">
              {order.first_item_image ? (
                <img src={order.first_item_image} alt={order.first_item_name} className="w-12 h-12 object-cover rounded-md border border-gray-100 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-800">{order.first_item_name}</p>
                {order.first_item_qty > 0 && <p className="text-xs text-gray-400 mt-0.5">Qty: {order.first_item_qty}</p>}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: React.ElementType; color: string; bg: string }) {
  return (
    <Card className="rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-md ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}

// ─── Order Row ─────────────────────────────────────────────────────────────────

function OrderRow({ order, onView }: { order: AdminOrder; onView: (o: AdminOrder) => void }) {
  const shortId = order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return (
    <TableRow>
      <Td className="px-4 py-3 text-xs font-mono font-semibold text-gray-700">#{shortId}</Td>
      <Td className="px-4 py-3 text-xs font-semibold text-gray-800">{order.customer_name}</Td>
      <Td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {order.first_item_image ? (
            <img src={order.first_item_image} alt={order.first_item_name} className="w-8 h-8 object-cover rounded-md border border-gray-100 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-gray-400" />
            </div>
          )}
          <span className="text-xs text-gray-700 max-w-[160px] truncate">{order.first_item_name}</span>
          {order.first_item_qty > 1 && <span className="text-xs text-gray-400">×{order.first_item_qty}</span>}
        </div>
      </Td>
      <Td className="px-4 py-3"><StatusBadge status={order.status} /></Td>
      <Td className="px-4 py-3 text-xs font-semibold text-gray-800">₦{parseFloat(order.total_price).toLocaleString()}</Td>
      <Td className="px-4 py-3 text-xs text-gray-500">{format(new Date(order.created_at), 'MMM d, yyyy')}</Td>
      <Td className="px-4 py-3">
        <button
          onClick={() => onView(order)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-[#E03E3E] hover:text-[#E03E3E] transition-colors"
          title="View details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </Td>
    </TableRow>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'review' | 'shipped';

export default function AdminOrderBookPage() {
  const { data: allOrders = [], isLoading, refetch, isFetching } = useAdminAllOrders();

  const [tab, setTab] = useState<Tab>('review');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewOrder, setViewOrder] = useState<AdminOrder | null>(null);

  const reviewOrders = allOrders.filter((o) => REVIEW_STATUSES.includes(o.status));
  const shippedOrders = allOrders.filter((o) => SHIPPED_STATUSES.includes(o.status));

  const activeOrders = tab === 'review' ? reviewOrders : shippedOrders;

  const filtered = search.trim()
    ? activeOrders.filter((o) =>
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.first_item_name.toLowerCase().includes(search.toLowerCase()) ||
        o.id.toLowerCase().includes(search.toLowerCase())
      )
    : activeOrders;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleTabChange(t: Tab) {
    setTab(t);
    setPage(1);
    setSearch('');
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-screen-xl">
      {viewOrder && <OrderDetailModal order={viewOrder} onClose={() => setViewOrder(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Book</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track orders in review and those shipped out to clients</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Awaiting Review" value={reviewOrders.filter((o) => o.status === 'PAID').length} icon={Clock} color="text-blue-500" bg="bg-blue-50" />
        <StatCard label="In Production" value={reviewOrders.filter((o) => ['IN_PRODUCTION', 'FRAME_ASSEMBLY', 'FRAME_RESERVED'].includes(o.status)).length} icon={Package} color="text-orange-500" bg="bg-orange-50" />
        <StatCard label="Ready / Shipped" value={shippedOrders.filter((o) => o.status === 'READY_FOR_PICKUP').length} icon={CheckCircle2} color="text-green-500" bg="bg-green-50" />
        <StatCard label="Out for Delivery" value={shippedOrders.filter((o) => o.status === 'SHIPPED').length} icon={Truck} color="text-teal-500" bg="bg-teal-50" />
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-md p-1">
          <button
            onClick={() => handleTabChange('review')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'review' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Clock className="w-3.5 h-3.5" />
            Ready for Review
            <span className={`text-xs px-1.5 py-0.5 rounded-md ${tab === 'review' ? 'bg-[#E03E3E] text-white' : 'bg-gray-200 text-gray-600'}`}>
              {reviewOrders.length}
            </span>
          </button>
          <button
            onClick={() => handleTabChange('shipped')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'shipped' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Truck className="w-3.5 h-3.5" />
            Shipped to Client
            <span className={`text-xs px-1.5 py-0.5 rounded-md ${tab === 'shipped' ? 'bg-[#E03E3E] text-white' : 'bg-gray-200 text-gray-600'}`}>
              {shippedOrders.length}
            </span>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search orders, customers…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 w-64"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <TableContainer className="rounded-md border border-gray-100 shadow-sm">
        <Table striped hoverable>
          <TableHead>
            <TableRow>
              <Th className="px-4 py-3 text-xs">Order ID</Th>
              <Th className="px-4 py-3 text-xs">Customer</Th>
              <Th className="px-4 py-3 text-xs">Product</Th>
              <Th className="px-4 py-3 text-xs">Status</Th>
              <Th className="px-4 py-3 text-xs">Total</Th>
              <Th className="px-4 py-3 text-xs">Date</Th>
              <Th className="px-4 py-3 text-xs">Actions</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                    </Td>
                  ))}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <Td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {tab === 'review' ? <Clock className="w-8 h-8 text-gray-200" /> : <Truck className="w-8 h-8 text-gray-200" />}
                    <p className="text-sm text-gray-400">
                      {search ? 'No orders match your search.' : tab === 'review' ? 'No orders awaiting review.' : 'No orders shipped yet.'}
                    </p>
                  </div>
                </Td>
              </TableRow>
            ) : (
              paginated.map((order) => (
                <OrderRow key={order.id} order={order} onView={setViewOrder} />
              ))
            )}
          </TableBody>
        </Table>

        {!isLoading && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            shownItems={paginated.length}
            noun="orders"
            onPageChange={setPage}
          />
        )}
      </TableContainer>
    </div>
  );
}
