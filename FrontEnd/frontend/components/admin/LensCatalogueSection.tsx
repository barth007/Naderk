'use client';

import React, { useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Layers, Check, X, Glasses, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import {
  useAdminLensTypes, useAdminLensOptions,
  useCreateLensType, useUpdateLensType, useDeleteLensType,
  useCreateLensOption, useUpdateLensOption, useDeleteLensOption,
  AdminLensType, AdminLensOption,
} from '@/services/admin/admin-lenses.hooks';

/**
 * Manage the lens catalogue the builder sells from.
 *
 * Lens types and options previously had no write path at all — the storefront
 * endpoints are GET-only, ecommerce registers no Django admin, and there is no
 * seeder, so rows could only be inserted straight into the database.
 */

const inputCls =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

function errText(e: unknown, fallback: string) {
  return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

/** Prices are naira; a zero modifier means the lens is bundled, not free-of-charge. */
function formatPrice(price: string) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+₦${n.toLocaleString()}` : 'Included';
}

type Draft = { name: string; description: string; price_modifier: string; is_active: boolean };

const EMPTY: Draft = { name: '', description: '', price_modifier: '0', is_active: true };

function LensForm({
  kind, initial, onCancel, onSubmit, pending,
}: {
  kind: 'type' | 'option';
  initial?: Draft;
  onCancel: () => void;
  onSubmit: (d: Draft) => void;
  pending: boolean;
}) {
  const [d, setD] = useState<Draft>(initial ?? EMPTY);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(p => ({ ...p, [k]: v }));

  return (
    <div className="p-4 bg-[#fffafa] border-y border-[#E03E3E]/15 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Name</label>
          <input
            autoFocus
            value={d.name}
            onChange={e => set('name', e.target.value)}
            className={inputCls}
            placeholder={kind === 'type' ? 'e.g. Progressive' : 'e.g. Anti-Reflective Coating'}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Price modifier
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">₦</span>
            <input
              value={d.price_modifier}
              onChange={e => set('price_modifier', e.target.value)}
              className={cn(inputCls, 'pl-7')}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {kind === 'type' && (
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Description <span className="text-gray-300 normal-case font-medium">— shown to patients</span>
          </label>
          <textarea
            value={d.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
            className={cn(inputCls, 'resize-none')}
            placeholder="A short line explaining who this lens suits."
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={d.is_active}
            onChange={e => set('is_active', e.target.checked)}
            className="accent-[#E03E3E]"
          />
          Offered to patients in the builder
        </label>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button
            onClick={() => onSubmit(d)}
            disabled={pending || !d.name.trim()}
            className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md hover:bg-[#c93535] disabled:opacity-50"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  name, price, active, description, isLast, onEdit, onDelete,
}: {
  name: string; price: string; active: boolean; description?: string; isLast: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/70',
        !isLast && 'border-b border-gray-100',
        !active && 'bg-gray-50/40',
      )}
    >
      {/* A quiet status dot gives the list rhythm and reads faster than a badge. */}
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', active ? 'bg-emerald-500' : 'bg-gray-300')}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm font-bold truncate', active ? 'text-gray-800' : 'text-gray-400')}>
            {name}
          </p>
          {!active && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
              Hidden
            </span>
          )}
        </div>
        {description?.trim() ? (
          <p className="text-xs text-gray-400 truncate mt-0.5">{description}</p>
        ) : null}
      </div>

      <span
        className={cn(
          'shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-md whitespace-nowrap',
          Number(price) > 0 ? 'bg-gray-100 text-gray-700' : 'bg-emerald-50 text-emerald-700',
        )}
      >
        {formatPrice(price)}
      </span>

      {/* Always reachable, but quiet until the row is hovered. */}
      <div className="shrink-0 flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          title="Edit"
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          title="Delete"
          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Panel({
  icon, title, hint, count, onAdd, addLabel, children,
}: {
  icon: React.ReactNode; title: string; hint: string; count: number;
  onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-100 rounded-xl overflow-hidden shadow-none">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/70 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              {title}
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            </h3>
            <p className="text-[11px] text-gray-400 truncate">{hint}</p>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="shrink-0 flex items-center gap-1.5 border border-gray-200 bg-white text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      </div>
      {children}
    </Card>
  );
}

function EmptyState({ label, onAdd, addLabel }: { label: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="px-4 py-10 text-center space-y-3">
      <p className="text-xs text-gray-400">{label}</p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E03E3E] hover:underline"
      >
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </button>
    </div>
  );
}

export default function LensCatalogueSection() {
  const { data: types = [], isLoading: loadingTypes } = useAdminLensTypes();
  const { data: options = [], isLoading: loadingOptions } = useAdminLensOptions();

  const createType = useCreateLensType();
  const updateType = useUpdateLensType();
  const deleteType = useDeleteLensType();
  const createOption = useCreateLensOption();
  const updateOption = useUpdateLensOption();
  const deleteOption = useDeleteLensOption();

  const [addingType, setAddingType] = useState(false);
  const [editingType, setEditingType] = useState<AdminLensType | null>(null);
  const [addingOption, setAddingOption] = useState(false);
  const [editingOption, setEditingOption] = useState<AdminLensOption | null>(null);

  const removeType = (t: AdminLensType) => {
    if (!confirm(`Delete lens type "${t.name}"?`)) return;
    deleteType.mutate(t.id, {
      onSuccess: () => toast.success('Lens type deleted.'),
      // A lens used by past orders is protected — the API says to deactivate.
      onError: (e) => toast.error(errText(e, 'Failed to delete lens type.')),
    });
  };

  const removeOption = (o: AdminLensOption) => {
    if (!confirm(`Delete lens option "${o.name}"?`)) return;
    deleteOption.mutate(o.id, {
      onSuccess: () => toast.success('Lens option deleted.'),
      onError: (e) => toast.error(errText(e, 'Failed to delete lens option.')),
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" /> Lens Catalogue
        </h2>
        <span className="text-xs text-gray-400">— what the builder offers, and what each adds to the price</span>
      </div>

      {/* items-start so each panel is only as tall as its own rows — grid
          items stretch by default, which left a large empty area under
          whichever list was shorter. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* ── Lens types ── */}
        <Panel
          icon={<Glasses className="w-4 h-4" />}
          title="Lens Types"
          hint="The lens itself — one is chosen per pair"
          count={types.length}
          onAdd={() => { setAddingType(true); setEditingType(null); }}
          addLabel="Add Type"
        >
          {addingType && (
            <LensForm
              kind="type"
              pending={createType.isPending}
              onCancel={() => setAddingType(false)}
              onSubmit={(d) => createType.mutate(d, {
                onSuccess: () => { toast.success('Lens type added.'); setAddingType(false); },
                onError: (e) => toast.error(errText(e, 'Failed to add lens type.')),
              })}
            />
          )}

          {loadingTypes ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : types.length === 0 && !addingType ? (
            <EmptyState
              label="No lens types yet — the builder has nothing to offer."
              onAdd={() => setAddingType(true)}
              addLabel="Add the first lens type"
            />
          ) : (
            types.map((t, i) => editingType?.id === t.id ? (
              <LensForm
                key={t.id}
                kind="type"
                pending={updateType.isPending}
                initial={{ name: t.name, description: t.description, price_modifier: t.price_modifier, is_active: t.is_active }}
                onCancel={() => setEditingType(null)}
                onSubmit={(d) => updateType.mutate({ id: t.id, ...d }, {
                  onSuccess: () => { toast.success('Lens type updated.'); setEditingType(null); },
                  onError: (e) => toast.error(errText(e, 'Failed to update lens type.')),
                })}
              />
            ) : (
              <Row
                key={t.id}
                name={t.name}
                price={t.price_modifier}
                active={t.is_active}
                description={t.description}
                isLast={i === types.length - 1}
                onEdit={() => { setEditingType(t); setAddingType(false); }}
                onDelete={() => removeType(t)}
              />
            ))
          )}
        </Panel>

        {/* ── Lens options ── */}
        <Panel
          icon={<Sparkles className="w-4 h-4" />}
          title="Options & Coatings"
          hint="Add-ons — any number can be stacked"
          count={options.length}
          onAdd={() => { setAddingOption(true); setEditingOption(null); }}
          addLabel="Add Option"
        >
          {addingOption && (
            <LensForm
              kind="option"
              pending={createOption.isPending}
              onCancel={() => setAddingOption(false)}
              onSubmit={(d) => createOption.mutate(d, {
                onSuccess: () => { toast.success('Lens option added.'); setAddingOption(false); },
                onError: (e) => toast.error(errText(e, 'Failed to add lens option.')),
              })}
            />
          )}

          {loadingOptions ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : options.length === 0 && !addingOption ? (
            <EmptyState
              label="No coatings or add-ons yet."
              onAdd={() => setAddingOption(true)}
              addLabel="Add the first option"
            />
          ) : (
            options.map((o, i) => editingOption?.id === o.id ? (
              <LensForm
                key={o.id}
                kind="option"
                pending={updateOption.isPending}
                initial={{ name: o.name, description: '', price_modifier: o.price_modifier, is_active: o.is_active }}
                onCancel={() => setEditingOption(null)}
                onSubmit={(d) => updateOption.mutate({ id: o.id, ...d }, {
                  onSuccess: () => { toast.success('Lens option updated.'); setEditingOption(null); },
                  onError: (e) => toast.error(errText(e, 'Failed to update lens option.')),
                })}
              />
            ) : (
              <Row
                key={o.id}
                name={o.name}
                price={o.price_modifier}
                active={o.is_active}
                isLast={i === options.length - 1}
                onEdit={() => { setEditingOption(o); setAddingOption(false); }}
                onDelete={() => removeOption(o)}
              />
            ))
          )}
        </Panel>
      </div>
    </section>
  );
}
