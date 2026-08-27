'use client';

import React, { useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Layers, Check, X } from 'lucide-react';
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
 * seeder, so rows could only be inserted straight into the database. This page
 * already read them to target recommendation rules but could not create one.
 */

const inputCls =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

function errText(e: unknown, fallback: string) {
  return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
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
    <Card className="p-4 border border-[#E03E3E]/20 rounded-lg space-y-3 bg-red-50/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Name</label>
          <input value={d.name} onChange={e => set('name', e.target.value)} className={inputCls}
            placeholder={kind === 'type' ? 'e.g. Progressive' : 'e.g. Anti-Reflective Coating'} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Price modifier (₦)
          </label>
          <input value={d.price_modifier} onChange={e => set('price_modifier', e.target.value)}
            className={inputCls} inputMode="decimal" placeholder="0.00" />
        </div>
      </div>

      {kind === 'type' && (
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Description</label>
          <textarea value={d.description} onChange={e => set('description', e.target.value)} rows={2}
            className={cn(inputCls, 'resize-none')} placeholder="Shown to patients in the builder." />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
        <input type="checkbox" checked={d.is_active} onChange={e => set('is_active', e.target.checked)} />
        Active — offered to patients in the builder
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button onClick={() => onSubmit(d)} disabled={pending || !d.name.trim()}
          className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-[#c93535] disabled:opacity-50">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
        </button>
      </div>
    </Card>
  );
}

function Row({
  name, price, active, description, onEdit, onDelete,
}: {
  name: string; price: string; active: boolean; description?: string;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <Card className="p-3 border border-gray-100 rounded-lg flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span className="truncate">{name}</span>
          {!active && (
            <span className="text-[8px] font-bold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
              Inactive
            </span>
          )}
        </p>
        {description ? <p className="text-xs text-gray-400 truncate mt-0.5">{description}</p> : null}
      </div>
      <span className="text-xs font-bold text-gray-700 shrink-0">
        +₦{Number(price).toLocaleString()}
      </span>
      <button onClick={onEdit} aria-label={`Edit ${name}`}
        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md shrink-0">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} aria-label={`Delete ${name}`}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </Card>
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
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" /> Lens Catalogue
        </h2>
        <span className="text-xs text-gray-400">— what the builder offers, and what each adds to the price</span>
      </div>

      {/* Lens types */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Lens Types</h3>
          <button onClick={() => { setAddingType(true); setEditingType(null); }}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Add Lens Type
          </button>
        </div>

        {addingType && (
          <LensForm kind="type" pending={createType.isPending}
            onCancel={() => setAddingType(false)}
            onSubmit={(d) => createType.mutate(d, {
              onSuccess: () => { toast.success('Lens type added.'); setAddingType(false); },
              onError: (e) => toast.error(errText(e, 'Failed to add lens type.')),
            })} />
        )}

        {loadingTypes ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : types.length === 0 && !addingType ? (
          <p className="text-xs text-gray-400 italic py-4">
            No lens types yet. Add one so the builder has something to offer.
          </p>
        ) : (
          types.map(t => editingType?.id === t.id ? (
            <LensForm key={t.id} kind="type" pending={updateType.isPending}
              initial={{ name: t.name, description: t.description, price_modifier: t.price_modifier, is_active: t.is_active }}
              onCancel={() => setEditingType(null)}
              onSubmit={(d) => updateType.mutate({ id: t.id, ...d }, {
                onSuccess: () => { toast.success('Lens type updated.'); setEditingType(null); },
                onError: (e) => toast.error(errText(e, 'Failed to update lens type.')),
              })} />
          ) : (
            <Row key={t.id} name={t.name} price={t.price_modifier} active={t.is_active}
              description={t.description}
              onEdit={() => { setEditingType(t); setAddingType(false); }}
              onDelete={() => removeType(t)} />
          ))
        )}
      </div>

      {/* Lens options */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Lens Options &amp; Coatings</h3>
          <button onClick={() => { setAddingOption(true); setEditingOption(null); }}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Add Lens Option
          </button>
        </div>

        {addingOption && (
          <LensForm kind="option" pending={createOption.isPending}
            onCancel={() => setAddingOption(false)}
            onSubmit={(d) => createOption.mutate(d, {
              onSuccess: () => { toast.success('Lens option added.'); setAddingOption(false); },
              onError: (e) => toast.error(errText(e, 'Failed to add lens option.')),
            })} />
        )}

        {loadingOptions ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : options.length === 0 && !addingOption ? (
          <p className="text-xs text-gray-400 italic py-4">No lens options yet.</p>
        ) : (
          options.map(o => editingOption?.id === o.id ? (
            <LensForm key={o.id} kind="option" pending={updateOption.isPending}
              initial={{ name: o.name, description: '', price_modifier: o.price_modifier, is_active: o.is_active }}
              onCancel={() => setEditingOption(null)}
              onSubmit={(d) => updateOption.mutate({ id: o.id, ...d }, {
                onSuccess: () => { toast.success('Lens option updated.'); setEditingOption(null); },
                onError: (e) => toast.error(errText(e, 'Failed to update lens option.')),
              })} />
          ) : (
            <Row key={o.id} name={o.name} price={o.price_modifier} active={o.is_active}
              onEdit={() => { setEditingOption(o); setAddingOption(false); }}
              onDelete={() => removeOption(o)} />
          ))
        )}
      </div>
    </section>
  );
}
