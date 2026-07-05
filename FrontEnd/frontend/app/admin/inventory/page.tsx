'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Glasses, Droplets,
  Plus, Zap, Package, ShoppingCart, BarChart2, Boxes,
  History, RotateCcw, Trophy, Download, X, TrendingUp,
  Pencil, Trash2, Eye, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, Th, Td,
} from '@/components/ui/table';
import {
  useAdminInventorySummary,
  useAdminAllOrders,
  useAdminProducts,
  useAdminProductHistory,
  useAdminRestockProduct,
  useAdminToggleProductStatus,
  useAdminProductDetail,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  AdminProduct,
} from '@/services/admin/admin-inventory.hooks';
import {
  useAdminCategories,
  useAdminCreateCategory,
  useAdminUpdateCategory,
  useAdminDeleteCategory,
} from '@/services/admin/admin-categories.hooks';
import {
  useAdminFlashSales,
  useAdminCreateFlashSale,
  useAdminUpdateFlashSale,
  useAdminDeleteFlashSale,
} from '@/services/admin/admin-flash-sales.hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const CATEGORY_COLORS = ['#E03E3E', '#38bdf8', '#1e293b', '#a3e635', '#f59e0b', '#8b5cf6'];

const ORDER_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PROCESSING:          { label: 'Processing',       className: 'bg-orange-50 text-orange-600' },
  PENDING:             { label: 'Pending',           className: 'bg-yellow-50 text-yellow-600' },
  PAID:                { label: 'Paid',              className: 'bg-blue-50 text-blue-600' },
  PRESCRIPTION_REVIEW: { label: 'Under Review',     className: 'bg-purple-50 text-purple-600' },
  FRAME_RESERVED:      { label: 'Frame Reserved',   className: 'bg-blue-50 text-blue-600' },
  IN_PRODUCTION:       { label: 'In Production',    className: 'bg-blue-50 text-blue-600' },
  READY_FOR_PICKUP:    { label: 'Ready For Pickup', className: 'bg-green-50 text-green-600' },
  SHIPPED:             { label: 'Shipped',           className: 'bg-green-50 text-green-600' },
  DELIVERED:           { label: 'Delivered',         className: 'bg-green-50 text-green-600' },
  CANCELLED:           { label: 'Cancelled',         className: 'bg-red-50 text-red-600' },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';
interface ToastState { message: string; type: ToastType; id: number }

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {toast.message}
      <button onClick={onDismiss} className="ml-1 opacity-75 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₦${n.toLocaleString('en-NG')}`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return format(new Date(iso), 'MMM d');
}

function exportCSV(products: AdminProduct[]) {
  const headers = ['Product Name', 'Category', 'Stock Qty', 'Units Sold', 'Revenue (₦)', 'Price (₦)', 'Status'];
  const rows = products.map((p) => [
    p.name,
    p.category_name,
    p.quantity_available,
    p.units_sold,
    p.revenue,
    p.price,
    p.is_active ? 'Active' : 'Inactive',
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 64, h = 24;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(' ');
  const hasActivity = data.some((v) => v > 0);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {hasActivity ? (
        <polyline
          points={points}
          fill="none"
          stroke="#E03E3E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#e5e7eb" strokeWidth="1.5" />
      )}
    </svg>
  );
}

// ─── Low Stock Alert Card ─────────────────────────────────────────────────────

function LowStockCard({ name, qty, category }: { name: string; qty: number; category: string }) {
  const isOptical = /lens|frame|glass|bifocal|optical/i.test(category + name);
  return (
    <div className="flex items-center gap-3 border border-red-100 rounded-md p-3 bg-white min-w-[170px]">
      <div className="w-9 h-9 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
        {isOptical ? <Glasses className="w-4 h-4 text-[#E03E3E]" /> : <Droplets className="w-4 h-4 text-[#E03E3E]" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 leading-tight">{name}</p>
        <p className="text-xs font-semibold text-[#E03E3E] mt-0.5">{qty} Units Left</p>
      </div>
    </div>
  );
}

// ─── E-Commerce Order Card ────────────────────────────────────────────────────

function OrderCard({ order }: { order: { id: string; customer_name: string; status: string; total_price: string; first_item_name: string; first_item_image: string | null; first_item_qty: number } }) {
  const statusStyle = ORDER_STATUS_STYLES[order.status] ?? { label: order.status, className: 'bg-gray-50 text-gray-600' };
  const shortId = order.id.replace(/-/g, '').slice(0, 5).toUpperCase();
  return (
    <Card className="rounded-md border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400 font-medium">ORDER #{shortId}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${statusStyle.className}`}>{statusStyle.label}</span>
      </div>
      <p className="text-sm font-bold text-gray-900 mb-3">{order.customer_name}</p>
      <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
        {order.first_item_image ? (
          <img src={order.first_item_image} alt={order.first_item_name} className="w-12 h-12 object-cover rounded-md border border-gray-100 flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-gray-400" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-800 leading-tight">{order.first_item_name}</p>
          {order.first_item_qty > 0 && <p className="text-xs text-gray-500 mt-0.5">Qty: {order.first_item_qty}</p>}
        </div>
      </div>
      <p className="text-sm font-bold text-gray-900 mt-3 border-t border-gray-100 pt-3">{formatPrice(order.total_price)}</p>
    </Card>
  );
}

// ─── Restock Modal ────────────────────────────────────────────────────────────

function RestockModal({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const [qty, setQty] = useState('');
  const { mutate: restock, isPending } = useAdminRestockProduct();

  function submit() {
    const n = parseInt(qty);
    if (!n || n <= 0) return;
    restock({ id: product.id, quantity: n }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Restock Product</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-1">{product.name}</p>
        <p className="text-xs text-gray-400 mb-4">Current stock: <span className="font-semibold text-gray-700">{product.quantity_available} units</span></p>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Units to add</label>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="e.g. 50"
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isPending || !qty}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────

function HistoryModal({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const { data: history = [], isLoading } = useAdminProductHistory(product.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-96 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Stock History — {product.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2.5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-50 rounded-md animate-pulse" />
            ))
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sales history yet.</p>
          ) : (
            history.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#E03E3E] mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      {item.type === 'SOLD' ? `Sold ${item.quantity} unit${item.quantity > 1 ? 's' : ''}` : `Restocked +${item.quantity}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.type === 'SOLD' ? `${item.customer} · Order #${item.order_id}` : 'Stock adjustment'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(item.date)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── View Product Modal ───────────────────────────────────────────────────────

function ViewProductModal({ product, onClose, onEdit }: { product: AdminProduct; onClose: () => void; onEdit: () => void }) {
  const { data: detail, isLoading } = useAdminProductDetail(product.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[520px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Product Details</h3>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-semibold text-[#E03E3E] hover:text-[#c93535] transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : detail ? (
          <div className="overflow-y-auto flex-1 space-y-4">
            {/* Images */}
            {detail.images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {detail.images.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-100 flex-shrink-0">
                    <img src={url} alt={detail.name} className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-black/50 text-white py-0.5">Cover</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: detail.name },
                { label: 'Category', value: detail.category_name },
                { label: 'Price', value: `₦${parseFloat(detail.price).toLocaleString()}` },
                { label: 'Stock Qty', value: detail.quantity_available },
                { label: 'Low Stock At', value: detail.low_stock_threshold },
                { label: 'Status', value: detail.is_active ? 'Active' : 'Inactive' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-md px-3 py-2.5">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{String(value)}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{detail.description}</p>
            </div>

            {/* Variants */}
            {detail.variants.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Variants ({detail.variants.length})</p>
                <div className="space-y-1.5">
                  {detail.variants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between border border-gray-100 rounded-md px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{v.variant_name}</p>
                        {v.sku && <p className="text-xs text-gray-400">SKU: {v.sku}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Qty: {v.quantity_available}</p>
                        {parseFloat(v.price_modifier) !== 0 && (
                          <p className="text-xs text-gray-400">{parseFloat(v.price_modifier) > 0 ? '+' : ''}₦{parseFloat(v.price_modifier).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Failed to load product details.</p>
        )}
      </Card>
    </div>
  );
}

// ─── Edit Product Modal ───────────────────────────────────────────────────────

function EditProductModal({ product, onClose, onSuccess }: { product: AdminProduct; onClose: () => void; onSuccess: (msg: string) => void }) {
  const { data: detail, isLoading } = useAdminProductDetail(product.id);
  const { mutate: updateProduct, isPending } = useAdminUpdateProduct();
  const { data: categories = [] } = useAdminCategories();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [threshold, setThreshold] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');

  // Hydrate form from loaded detail
  React.useEffect(() => {
    if (detail && !hydrated) {
      setName(detail.name);
      setDescription(detail.description);
      setPrice(detail.price);
      setQty(String(detail.quantity_available));
      setThreshold(String(detail.low_stock_threshold));
      setCategoryId(detail.category_id);
      setHydrated(true);
    }
  }, [detail, hydrated]);

  function handleSave() {
    if (!name.trim()) { setError('Product name is required.'); return; }
    if (!price || parseFloat(price) <= 0) { setError('Enter a valid price.'); return; }
    setError('');
    updateProduct(
      { id: product.id, name: name.trim(), description: description.trim(), price, quantity_available: parseInt(qty), low_stock_threshold: parseInt(threshold), category_id: categoryId },
      {
        onSuccess: () => { onSuccess('Product updated successfully!'); onClose(); },
        onError: () => setError('Failed to update product.'),
      }
    );
  }

  const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[520px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Edit Product</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Product Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputCls} bg-white`}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Price (₦) *</label>
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Stock Qty</label>
                <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Low Stock At</label>
                <input type="number" min="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || isLoading}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Delete Product Modal ─────────────────────────────────────────────────────

function DeleteProductModal({ product, onClose, onSuccess }: { product: AdminProduct; onClose: () => void; onSuccess: (msg: string) => void }) {
  const { mutate: deleteProduct, isPending } = useAdminDeleteProduct();

  function handleDelete() {
    deleteProduct(product.id, {
      onSuccess: () => { onSuccess('Product deleted.'); onClose(); },
      onError: () => {},
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-80">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-[#E03E3E]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Delete Product</h3>
            <p className="text-xs text-gray-500 mt-1">This will permanently delete <span className="font-semibold text-gray-800">{product.name}</span>. This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</> : 'Delete'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Manage Categories Modal ──────────────────────────────────────────────────

function ManageCategoriesModal({ onClose, onToast }: { onClose: () => void; onToast: (msg: string, type: ToastType) => void }) {
  const { data: cats = [], isLoading } = useAdminCategories();
  const { mutate: createCat, isPending: creating } = useAdminCreateCategory();
  const { mutate: updateCat, isPending: updating } = useAdminUpdateCategory();
  const { mutate: deleteCat, isPending: deleting } = useAdminDeleteCategory();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  function handleCreate() {
    if (!newName.trim()) { setError('Category name is required.'); return; }
    setError('');
    createCat({ name: newName.trim(), description: newDesc.trim() || undefined }, {
      onSuccess: () => {
        setNewName(''); setNewDesc('');
        onToast('Category created successfully!', 'success');
      },
      onError: () => onToast('Failed to create category.', 'error'),
    });
  }

  function startEdit(cat: { id: string; name: string }) {
    setEditId(cat.id);
    setEditName(cat.name);
  }

  function saveEdit() {
    if (!editId) return;
    updateCat({ id: editId, name: editName.trim() }, {
      onSuccess: () => { setEditId(null); onToast('Category updated.', 'success'); },
      onError: () => onToast('Failed to update category.', 'error'),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Manage Categories</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Add new */}
        <div className="bg-gray-50 rounded-md p-3 mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Add New Category</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Category name *"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 mb-2"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 mb-2"
          />
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors"
          >
            {creating ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating…</> : 'Add Category'}
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-md animate-pulse" />
            ))
          ) : cats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No categories yet.</p>
          ) : (
            cats.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 border border-gray-100 rounded-md px-3 py-2.5">
                {editId === cat.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#E03E3E]/30"
                      autoFocus
                    />
                    <button
                      onClick={saveEdit}
                      disabled={updating}
                      className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save
                    </button>
                    <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{cat.name}</p>
                      <p className="text-xs text-gray-400">{cat.product_count} product{cat.product_count !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={() => startEdit(cat)} className="text-xs text-[#E03E3E] hover:underline font-medium">Edit</button>
                    {cat.product_count > 0 ? (
                      <span className="text-xs text-gray-300" title="Reassign or remove all products first to delete this category">
                        Delete
                      </span>
                    ) : (
                      <button
                        onClick={() => deleteCat(cat.id, {
                          onSuccess: () => onToast('Category deleted.', 'success'),
                          onError: () => onToast('Failed to delete category.', 'error'),
                        })}
                        disabled={deleting}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                      >
                        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Launch Flash Sale Modal ───────────────────────────────────────────────────

function FlashSaleModal({ onClose, allProducts }: { onClose: () => void; allProducts: AdminProduct[] }) {
  const { data: existingSales = [], isLoading: salesLoading } = useAdminFlashSales();
  const { mutate: createSale, isPending: creating } = useAdminCreateFlashSale();
  const { mutate: updateSale, isPending: updating } = useAdminUpdateFlashSale();
  const { mutate: deleteSale, isPending: deleting } = useAdminDeleteFlashSale();

  const [tab, setTab] = useState<'create' | 'manage'>('create');
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCreate() {
    if (!name.trim()) { setError('Sale name is required.'); return; }
    if (!discount || parseFloat(discount) <= 0 || parseFloat(discount) > 100) { setError('Discount must be between 1–100%.'); return; }
    if (!startsAt || !endsAt) { setError('Start and end dates are required.'); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { setError('End date must be after start date.'); return; }
    setError('');
    createSale(
      {
        name: name.trim(),
        discount_percent: parseFloat(discount),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        product_ids: Array.from(selectedIds),
      },
      {
        onSuccess: () => {
          setSuccess('Flash sale created!');
          setName(''); setDiscount(''); setStartsAt(''); setEndsAt(''); setSelectedIds(new Set());
          setTimeout(() => setSuccess(''), 3000);
          setTab('manage');
        },
        onError: () => setError('Failed to create flash sale.'),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[560px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#E03E3E]" />
            <h3 className="text-sm font-bold text-gray-900">Flash Sales</h3>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-50 rounded-md p-1 mb-4">
          {(['create', 'manage'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'create' ? 'Create New' : `Manage (${existingSales.length})`}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {tab === 'create' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Sale Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Sale" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Discount % *</label>
                <input type="number" min="1" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="e.g. 20" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Starts At *</label>
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Ends At *</label>
                  <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Products to include ({selectedIds.size} selected)</label>
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {allProducts.filter((p) => p.is_active).map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="accent-[#E03E3E]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category_name} · ₦{parseFloat(p.price).toLocaleString()}</p>
                      </div>
                      {selectedIds.has(p.id) && discount && (
                        <span className="text-xs font-semibold text-green-600 flex-shrink-0">
                          → ₦{(parseFloat(p.price) * (1 - parseFloat(discount) / 100)).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
              {success && <p className="text-xs text-green-600">{success}</p>}

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-[#E03E3E] text-white text-sm font-semibold py-2.5 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {creating ? 'Launching…' : 'Launch Flash Sale'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {salesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-50 rounded-md animate-pulse" />
                ))
              ) : existingSales.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No flash sales yet. Create one!</p>
              ) : (
                existingSales.map((sale) => (
                  <div key={sale.id} className="border border-gray-100 rounded-md p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{sale.name}</p>
                          {sale.is_live && (
                            <span className="text-xs font-semibold bg-green-50 text-green-600 px-2 py-0.5 rounded-md">LIVE</span>
                          )}
                          {!sale.is_active && (
                            <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {sale.discount_percent}% off · {sale.product_count} products · Ends {format(new Date(sale.ends_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateSale({ id: sale.id, is_active: !sale.is_active })}
                          disabled={updating}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${sale.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                          {sale.is_active ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => deleteSale(sale.id)}
                          disabled={deleting}
                          className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const { data: summary, isLoading: summaryLoading } = useAdminInventorySummary();
  const { data: productsData, isLoading: productsLoading } = useAdminProducts();
  const { mutate: _toggleStatus } = useAdminToggleProductStatus();
  const toggleStatus = (product: AdminProduct) => {
    _toggleStatus(product.id, {
      onSuccess: () => showToast(`${product.name} ${product.is_active ? 'deactivated' : 'activated'}.`, 'success'),
      onError: () => showToast('Failed to update status.', 'error'),
    });
  };

  const allProducts = productsData?.products ?? [];
  const productsSummary = productsData?.summary;

  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [restockProduct, setRestockProduct] = useState<AdminProduct | null>(null);
  const [historyProduct, setHistoryProduct] = useState<AdminProduct | null>(null);
  const [viewProduct, setViewProduct] = useState<AdminProduct | null>(null);
  const [editProduct, setEditProduct] = useState<AdminProduct | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<AdminProduct | null>(null);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => setToast((t) => t?.id === id ? null : t), 4000);
  }, []);

  // Category filter options
  const categories = ['All', ...Array.from(new Set(allProducts.map((p) => p.category_name))).sort()];

  // Filtered + paginated
  const filtered = categoryFilter === 'All' ? allProducts : allProducts.filter((p) => p.category_name === categoryFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Top 5 sellers
  const topSellers = [...allProducts].sort((a, b) => b.units_sold - a.units_sold).slice(0, 5);

  return (
    <div className="p-6 flex flex-col gap-5 max-w-screen-xl relative">
      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      {/* Modals */}
      {restockProduct && (
        <RestockModal product={restockProduct} onClose={() => setRestockProduct(null)} />
      )}
      {historyProduct && (
        <HistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}
      {viewProduct && !editProduct && (
        <ViewProductModal
          product={viewProduct}
          onClose={() => setViewProduct(null)}
          onEdit={() => { setEditProduct(viewProduct); setViewProduct(null); }}
        />
      )}
      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}
      {deleteProduct && (
        <DeleteProductModal
          product={deleteProduct}
          onClose={() => setDeleteProduct(null)}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}
      {showFlashSaleModal && <FlashSaleModal onClose={() => setShowFlashSaleModal(false)} allProducts={allProducts} />}
      {showCategoriesModal && <ManageCategoriesModal onClose={() => setShowCategoriesModal(false)} onToast={showToast} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitoring clinical supplies and e-commerce stock levels</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Boxes className="w-4 h-4" />
            Manage Categories
          </button>
          <button
            onClick={() => setShowFlashSaleModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-[#E03E3E] text-[#E03E3E] text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Launch Flash Sale
          </button>
          <Link
            href="/admin/inventory/new"
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#E03E3E] text-white text-sm font-semibold hover:bg-[#c93535] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </Link>
        </div>
      </div>

      {/* Row 1: Global Inventory + Low Stock Alerts */}
      <div className="flex gap-5 items-stretch overflow-hidden">
        <Card className="rounded-md border border-gray-100 shadow-sm p-5 w-64 flex-shrink-0">
          <p className="text-sm text-gray-500 font-medium">Global Inventory</p>
          {summaryLoading ? (
            <div className="h-10 bg-gray-100 rounded-md animate-pulse mt-2" />
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-900 mt-1">{(summary?.total_stock ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Total count across {summary?.category_count ?? 0} categories</p>
              <div className="flex gap-1.5 mt-4">
                {(summary?.by_category ?? []).slice(0, 4).map((cat, i) => (
                  <div key={cat.category__name} className="h-1.5 rounded-full flex-1" style={{ background: CATEGORY_COLORS[i] ?? '#e5e7eb' }} title={`${cat.category__name}: ${cat.total}`} />
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Low Stock — bare label + scrollable cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E03E3E]" />
              <span className="text-sm font-bold text-gray-900">Critical Low Stock Alerts</span>
            </div>
            {!summaryLoading && (summary?.low_stock_alerts?.length ?? 0) > 0 && (
              <span className="text-xs font-semibold bg-red-50 text-[#E03E3E] px-2.5 py-1 rounded-md">
                {summary!.low_stock_alerts.length} Actions Required
              </span>
            )}
          </div>
          {summaryLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 w-44 flex-shrink-0 bg-gray-100 rounded-md animate-pulse" />)}
            </div>
          ) : (summary?.low_stock_alerts ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">All stock levels are healthy (none below 15 units).</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {summary!.low_stock_alerts.map((alert) => (
                <div key={alert.id} className="flex-shrink-0">
                  <LowStockCard name={alert.name} qty={alert.quantity_available} category={alert.category__name ?? ''} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Selling Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-bold text-gray-900">Top Selling Products</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {productsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-44 h-24 bg-gray-100 rounded-md animate-pulse" />
            ))
          ) : topSellers.length === 0 ? (
            <p className="text-sm text-gray-400">No sales data yet.</p>
          ) : (
            topSellers.map((p, rank) => (
              <Card key={p.id} className="flex-shrink-0 rounded-md border border-gray-100 shadow-sm p-4 w-48">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-500">#{rank + 1}</span>
                  <span className="text-xs text-gray-400">{p.category_name}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{p.name}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{p.units_sold.toLocaleString()}</p>
                <p className="text-xs text-gray-400">units sold</p>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Product Table */}
      <div className="flex flex-col gap-4">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Boxes className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Products</p>
                {productsLoading ? <div className="h-5 w-12 bg-gray-100 rounded animate-pulse mt-0.5" /> : (
                  <p className="text-lg font-bold text-gray-900">{productsSummary?.total_products ?? 0}</p>
                )}
              </div>
            </Card>
            <Card className="rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-green-50 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Units Sold Today</p>
                {productsLoading ? <div className="h-5 w-12 bg-gray-100 rounded animate-pulse mt-0.5" /> : (
                  <p className="text-lg font-bold text-gray-900">{productsSummary?.total_units_sold_today ?? 0}</p>
                )}
              </div>
            </Card>
            <Card className="rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-orange-50 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Stock Remaining</p>
                {productsLoading ? <div className="h-5 w-12 bg-gray-100 rounded animate-pulse mt-0.5" /> : (
                  <p className="text-lg font-bold text-gray-900">{(productsSummary?.total_stock_remaining ?? 0).toLocaleString()}</p>
                )}
              </div>
            </Card>
          </div>

          {/* Table controls */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">Product Management</h2>
            <div className="flex items-center gap-2">
              {/* Category filter */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  className="appearance-none border border-gray-200 rounded-md pl-3 pr-7 py-1.5 text-xs font-medium text-gray-700 bg-white focus:outline-none cursor-pointer"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronRight className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
              </div>
              {/* Export CSV */}
              <button
                onClick={() => exportCSV(filtered)}
                className="flex items-center gap-1.5 border border-gray-200 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <TableContainer className="rounded-md border-gray-100 shadow-sm">
            <div className="overflow-y-auto max-h-[600px]">
            <Table hoverable stickyHeader>
              <TableHead>
                <TableRow>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Product Name</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Category</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Stock</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Sold</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Revenue</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">7d</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Price</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5">Status</Th>
                  <Th className="normal-case tracking-normal text-xs font-semibold text-gray-700 px-3 py-2.5"></Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {productsLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      <Td colSpan={9}><div className="h-9 bg-gray-50 rounded-md animate-pulse" /></Td>
                    </TableRow>
                  ))
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <Td colSpan={9} className="py-12 text-center text-sm text-gray-400">No products found.</Td>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <Td className="font-medium text-gray-800 max-w-[160px] truncate px-3 py-2.5 text-xs">{product.name}</Td>
                      <Td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 text-xs font-medium whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          {product.category_name}
                        </span>
                      </Td>
                      <Td className="px-3 py-2.5 text-xs">
                        <span className={product.low_stock ? 'text-[#E03E3E] font-semibold' : 'text-gray-600'}>
                          {product.quantity_available}
                        </span>
                        {product.low_stock && <span className="ml-1 text-[#E03E3E]">⚠</span>}
                      </Td>
                      <Td className="text-gray-600 px-3 py-2.5 text-xs">{product.units_sold.toLocaleString()}</Td>
                      <Td className="font-semibold text-gray-800 whitespace-nowrap px-3 py-2.5 text-xs">{formatPrice(product.revenue)}</Td>
                      <Td className="px-3 py-2.5"><Sparkline data={product.sparkline} /></Td>
                      <Td className="text-gray-600 whitespace-nowrap px-3 py-2.5 text-xs">{formatPrice(product.price)}</Td>
                      <Td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleStatus(product)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${product.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                          title={product.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${product.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </Td>
                      <Td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewProduct(product)} title="View details" className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                            <Eye className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditProduct(product)} title="Edit product" className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-[#E03E3E] hover:text-[#E03E3E] transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => setRestockProduct(product)} title="Restock" className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button onClick={() => setHistoryProduct(product)} title="View history" className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                            <History className="w-3 h-3" />
                          </button>
                          <button onClick={() => setDeleteProduct(product)} title="Delete product" className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </Td>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>

            {!productsLoading && filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-100 bg-white">
                <span className="text-xs text-gray-500">
                  Showing {paginatedProducts.length} of {filtered.length} products
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    return (
                      <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 text-xs rounded-md font-medium border transition-colors ${safePage === p ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>{p}</button>
                    );
                  })}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TableContainer>
      </div>
    </div>
  );
}
