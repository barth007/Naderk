'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Power, Trash2, Loader2, X, Glasses, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import {
  useAdminFrames, useAdminCreateFrame, useAdminUpdateFrame, useAdminToggleFrame, useAdminDeleteFrame,
  GENDERS, RIM_TYPES, SIZE_CATEGORIES, FRAME_SHAPES, FRAME_MATERIALS,
  FramePayload, FrameVariantInput,
} from '@/services/admin/admin-frames.hooks';
import { Frame } from '@/services/marketplace/marketplace.types';
import ImageUploader from '@/components/admin/ImageUploader';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

const EMPTY: FramePayload = {
  name: '', brand: '', style: 'Rectangle', material: 'Acetate', base_price: '',
  gender: 'UNISEX', rim_type: 'FULL_RIM', size_category: 'MEDIUM', description: '', features: '',
  lens_width: null, bridge_width: null, temple_length: null, lens_height: null, total_width: null, weight_grams: null,
  images: [], variants: [],
};

const GENDER_STYLE: Record<string, string> = {
  MEN: 'bg-blue-50 text-blue-700', WOMEN: 'bg-pink-50 text-pink-700',
  UNISEX: 'bg-gray-100 text-gray-600', KIDS: 'bg-amber-50 text-amber-700',
};

// ─── Frame Modal ────────────────────────────────────────────────────────────

function FrameModal({ initial, onClose, onSaved }: { initial?: Frame; onClose: () => void; onSaved: (m: string) => void }) {
  const isEdit = !!initial;
  const { mutate: create, isPending: creating } = useAdminCreateFrame();
  const { mutate: update, isPending: updating } = useAdminUpdateFrame();
  const pending = creating || updating;

  const [form, setForm] = useState<FramePayload>(initial ? {
    name: initial.name, brand: initial.brand, style: initial.style, material: initial.material,
    base_price: initial.base_price, gender: initial.gender ?? 'UNISEX', rim_type: initial.rim_type ?? 'FULL_RIM',
    size_category: initial.size_category ?? 'MEDIUM', description: initial.description ?? '', features: initial.features ?? '',
    lens_width: initial.lens_width ?? null, bridge_width: initial.bridge_width ?? null, temple_length: initial.temple_length ?? null,
    lens_height: initial.lens_height ?? null, total_width: initial.total_width ?? null, weight_grams: initial.weight_grams ?? null,
    images: initial.images && initial.images.length ? initial.images : (initial.front_image ? [initial.front_image] : []),
    variants: initial.variants.map(v => ({ color: v.color, size: v.size, quantity_available: v.quantity_available, low_stock_threshold: v.low_stock_threshold, sku: v.sku })),
  } : { ...EMPTY, variants: [{ color: '', size: 'Medium', quantity_available: 0 }] });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setF = <K extends keyof FramePayload>(k: K, v: FramePayload[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  };
  const num = (v: string) => v === '' ? null : (parseInt(v) || null);

  const setVariant = (i: number, patch: Partial<FrameVariantInput>) =>
    setForm(p => ({ ...p, variants: (p.variants ?? []).map((v, idx) => idx === i ? { ...v, ...patch } : v) }));
  const addVariant = () => setForm(p => ({ ...p, variants: [...(p.variants ?? []), { color: '', size: 'Medium', quantity_available: 0 }] }));
  const removeVariant = (i: number) => setForm(p => ({ ...p, variants: (p.variants ?? []).filter((_, idx) => idx !== i) }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Frame name is required.';
    if (!form.brand.trim()) e.brand = 'Brand is required.';
    if (!form.base_price || isNaN(parseFloat(form.base_price))) e.base_price = 'Valid base price is required.';
    const validVariants = (form.variants ?? []).filter(v => v.color.trim() && v.size.trim());
    if (validVariants.length === 0) e.variants = 'Add at least one color/size variant.';
    if (Object.keys(e).length) {
      setErrors(e);
      // The field errors render inside the modal's scrollable body while the
      // Create button is pinned to the footer, so a blocked submit looked like
      // the button did nothing. Say so out loud.
      const LABELS: Record<string, string> = {
        name: 'Frame name', brand: 'Brand', base_price: 'Base price',
        variants: 'At least one colour/size variant',
      };
      toast.error('Frame not saved — required fields are missing.', {
        description: Object.keys(e).map(k => LABELS[k] ?? k).join(', '),
      });
      return;
    }

    const payload = { ...form, variants: validVariants };
    const apiErr = (err: any) => {
      const fe = err?.response?.data?.errors;
      if (fe) { const m: Record<string, string> = {}; for (const [k, v] of Object.entries(fe)) m[k] = Array.isArray(v) ? (v as string[])[0] : String(v); setErrors(m); }
      else setErrors({ _form: err?.response?.data?.detail || 'Failed to save frame.' });
    };
    const cb = { onSuccess: () => { onSaved(isEdit ? 'Frame updated.' : 'Frame created.'); onClose(); }, onError: apiErr };
    if (isEdit) update({ id: initial!.id, ...payload }, cb); else create(payload, cb);
  };

  const input = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';
  const lbl = 'text-xs font-semibold text-gray-700 block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="rounded-xl border border-gray-100 shadow-xl p-6 w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center"><Glasses className="w-4 h-4 text-[#E03E3E]" /></div>
            <h3 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Frame' : 'New Frame'}</h3>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Frame Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} className={input} placeholder="e.g. Aria Cat-Eye" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className={lbl}>Brand *</label>
              <input value={form.brand} onChange={e => setF('brand', e.target.value)} className={input} placeholder="e.g. Naderk" />
              {errors.brand && <p className="text-xs text-red-500 mt-1">{errors.brand}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Section *</label>
              <select value={form.gender} onChange={e => setF('gender', e.target.value as any)} className={`${input} bg-white`}>
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Shape</label>
              <select value={form.style} onChange={e => setF('style', e.target.value)} className={`${input} bg-white`}>
                {FRAME_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Rim Type</label>
              <select value={form.rim_type} onChange={e => setF('rim_type', e.target.value as any)} className={`${input} bg-white`}>
                {RIM_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Material</label>
              <select value={form.material} onChange={e => setF('material', e.target.value)} className={`${input} bg-white`}>
                {FRAME_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Size Category</label>
              <select value={form.size_category} onChange={e => setF('size_category', e.target.value as any)} className={`${input} bg-white`}>
                {SIZE_CATEGORIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Base Price (₦) *</label>
              <input type="number" value={form.base_price} onChange={e => setF('base_price', e.target.value)} className={input} placeholder="45000" />
              {errors.base_price && <p className="text-xs text-red-500 mt-1">{errors.base_price}</p>}
            </div>
          </div>

          <div>
            <label className={lbl}>Description</label>
            <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={2} className={`${input} resize-none`} placeholder="Shown to patients on the frame page" />
          </div>

          <div>
            <label className={lbl}>Features <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <input value={form.features} onChange={e => setF('features', e.target.value)} className={input} placeholder="Spring hinges, Adjustable nose pads" />
          </div>

          <div>
            <label className={lbl}>Images</label>
            <ImageUploader value={form.images ?? []} onChange={imgs => setF('images', imgs)} max={4} prefix="frames" />
          </div>

          {/* Measurements */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Measurements (mm)</p>
            <div className="grid grid-cols-3 gap-2">
              {([['lens_width', 'Lens width'], ['bridge_width', 'Bridge / nose'], ['temple_length', 'Temple length'], ['lens_height', 'Lens height'], ['total_width', 'Total width'], ['weight_grams', 'Weight (g)']] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
                  <input type="number" value={(form[key] as number | null) ?? ''} onChange={e => setF(key, num(e.target.value))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" />
                </div>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={lbl}>Colors & Sizes (variants) *</label>
              <button onClick={addVariant} type="button" className="text-xs font-semibold text-[#E03E3E] flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
            </div>
            {errors.variants && <p className="text-xs text-red-500 mb-1">{errors.variants}</p>}
            <div className="space-y-2">
              {(form.variants ?? []).map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_80px_1fr_28px] gap-2 items-center">
                  <input value={v.color} onChange={e => setVariant(i, { color: e.target.value })} className="border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="Color" />
                  <input value={v.size} onChange={e => setVariant(i, { size: e.target.value })} className="border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="Size" />
                  <input type="number" value={v.quantity_available} onChange={e => setVariant(i, { quantity_available: parseInt(e.target.value) || 0 })} className="border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="Qty" />
                  <input value={v.sku ?? ''} onChange={e => setVariant(i, { sku: e.target.value })} className="border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="SKU (optional)" />
                  <button onClick={() => removeVariant(i)} type="button" className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {errors._form && <p className="text-xs text-red-500">{errors._form}</p>}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={pending} className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 flex items-center justify-center gap-2">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} {isEdit ? 'Save Changes' : 'Create Frame'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminFramesPage() {
  const { data: frames = [], isLoading } = useAdminFrames();
  const { mutate: toggleFrame } = useAdminToggleFrame();
  const { mutate: deleteFrame } = useAdminDeleteFrame();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Frame | undefined>();
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  // Same guard as the services page: toggling under an active/inactive filter
  // drops the card out of the list, so the next click would land on whichever
  // frame slid into that spot.
  const [pendingToggle, setPendingToggle] = useState<Frame | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = frames.filter(f => filter === 'all' ? true : filter === 'active' ? f.is_active : !f.is_active);

  const confirmToggle = () => {
    const f = pendingToggle;
    if (!f) return;
    setTogglingId(f.id);
    toggleFrame(f.id, {
      onSuccess: () => toast.success(f.is_active ? `"${f.name}" deactivated.` : `"${f.name}" activated.`, {
        description: f.is_active ? 'Shoppers can no longer see this frame.' : 'Shoppers can now see this frame.',
      }),
      onError: () => toast.error(`Could not update "${f.name}".`),
      onSettled: () => { setTogglingId(null); setPendingToggle(null); },
    });
  };

  const handleDelete = (f: Frame) => {
    if (!confirm(`Delete frame "${f.name}"? This cannot be undone.`)) return;
    deleteFrame(f.id, {
      onSuccess: (res: any) => toast.success(res?.data?.data?.deactivated ? 'Frame is in use — deactivated instead.' : 'Frame deleted.'),
      onError: () => toast.error('Failed to delete frame.'),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><Glasses className="w-5 h-5 text-[#E03E3E]" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Frames</h1>
            <p className="text-sm text-gray-500">{frames.filter(f => f.is_active).length} active · {frames.filter(f => !f.is_active).length} inactive</p>
          </div>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }} className="flex items-center gap-2 bg-[#E03E3E] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#c93535]">
          <Plus className="w-4 h-4" /> New Frame
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter === f ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Glasses className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No frames yet</p>
          <p className="text-xs mt-1">Add your first frame to the catalogue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <Card key={f.id} className={`p-4 border rounded-xl ${f.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
              <div className="aspect-video bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {f.front_image ? <img src={f.front_image} alt={f.name} className="object-contain w-full h-full p-2" /> : <Glasses className="w-8 h-8 text-gray-300" />}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#E03E3E] uppercase tracking-wider">{f.brand}</p>
                  <h3 className="text-sm font-bold text-gray-900 truncate">{f.name}</h3>
                </div>
                <span className="text-sm font-bold text-gray-900 shrink-0">₦{parseFloat(f.base_price).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GENDER_STYLE[f.gender ?? 'UNISEX']}`}>{f.gender_display}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600">{f.style}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600">{f.rim_type_display}</span>
                {f.bridge_width && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">{f.lens_width}▢{f.bridge_width}–{f.temple_length}</span>}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">{f.variants.length} variant{f.variants.length !== 1 ? 's' : ''}</p>

              <div className="flex gap-1 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => { setEditing(f); setShowForm(true); }} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-md hover:bg-gray-50"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => setPendingToggle(f)} disabled={togglingId === f.id} className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${f.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>{togglingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />} {f.is_active ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => handleDelete(f)} className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-md ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <FrameModal initial={editing} onClose={() => { setShowForm(false); setEditing(undefined); }} onSaved={toast.success} />}

      <ConfirmationModal
        isOpen={!!pendingToggle}
        onClose={() => setPendingToggle(null)}
        onConfirm={confirmToggle}
        title={pendingToggle?.is_active ? 'Deactivate frame?' : 'Activate frame?'}
        description={
          pendingToggle
            ? pendingToggle.is_active
              ? `"${pendingToggle.name}" will be removed from the marketplace. Existing orders are not affected.`
              : `"${pendingToggle.name}" will appear in the marketplace for shoppers.`
            : ''
        }
        confirmText={pendingToggle?.is_active ? 'Deactivate' : 'Activate'}
        confirmButtonVariant={pendingToggle?.is_active ? 'destructive' : 'default'}
        isPending={!!togglingId}
      />
    </div>
  );
}
