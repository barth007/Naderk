'use client';

import React, { useState } from 'react';
import { CreditCard, Plus, X, Loader2, Trash2, Pencil, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminGateways, useCreateGateway, useUpdateGateway, useDeleteGateway,
  PaymentGateway, GatewayPayload,
} from '@/services/payments/admin-payments.hooks';

const PROVIDERS = [
  { value: 'PAYSTACK', label: 'Paystack' },
  { value: 'MONNIFY', label: 'Monnify' },
];
const MODES = [
  { value: 'TEST', label: 'Test' },
  { value: 'LIVE', label: 'Live' },
];

const clientKeyLabel = (provider: string) =>
  provider === 'MONNIFY' ? 'API Key' : 'Public Key';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#E03E3E]" />
      {label}
    </label>
  );
}

function GatewayModal({ gateway, onClose }: { gateway: PaymentGateway | null; onClose: () => void }) {
  const isEdit = !!gateway;
  const create = useCreateGateway();
  const update = useUpdateGateway();
  const pending = create.isPending || update.isPending;

  const [form, setForm] = useState<GatewayPayload>({
    provider: gateway?.provider ?? 'PAYSTACK',
    mode: gateway?.mode ?? 'TEST',
    display_name: gateway?.display_name ?? '',
    client_key: gateway?.client_key ?? '',
    secret_key: '',
    contract_code: gateway?.contract_code ?? '',
    is_active: gateway?.is_active ?? false,
    is_default: gateway?.is_default ?? false,
  });
  const set = (k: keyof GatewayPayload, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const isMonnify = form.provider === 'MONNIFY';

  const submit = async () => {
    if (!form.display_name?.trim()) { toast.error('Display name is required.'); return; }
    if (!isEdit && !form.secret_key?.trim()) { toast.error('Secret key is required.'); return; }
    if (isMonnify && !form.contract_code?.trim()) { toast.error('Contract code is required for Monnify.'); return; }
    try {
      const payload: GatewayPayload = { ...form };
      if (isEdit && !payload.secret_key) delete payload.secret_key;
      if (isEdit) {
        delete payload.provider;   // provider + mode are immutable (unique together)
        delete payload.mode;
        await update.mutateAsync({ id: gateway!.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      toast.success(`Gateway ${isEdit ? 'updated' : 'created'}.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save gateway.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-900">{isEdit ? 'Edit Gateway' : 'Add Payment Gateway'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700">Provider</label>
            <select
              value={form.provider}
              disabled={isEdit}
              onChange={(e) => set('provider', e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
            >
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700">Mode</label>
            <select
              value={form.mode}
              disabled={isEdit}
              onChange={(e) => set('mode', e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
            >
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Display Name</label>
          <input
            value={form.display_name}
            onChange={(e) => set('display_name', e.target.value)}
            placeholder="e.g. Paystack"
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">{clientKeyLabel(form.provider!)}</label>
          <input
            value={form.client_key}
            onChange={(e) => set('client_key', e.target.value)}
            placeholder={isMonnify ? 'MK_TEST_...' : 'pk_test_...'}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">
            Secret Key {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep {gateway?.secret_key_hint})</span>}
          </label>
          <input
            type="password"
            value={form.secret_key}
            onChange={(e) => set('secret_key', e.target.value)}
            placeholder={isMonnify ? 'Monnify secret key' : 'sk_test_...'}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm font-mono"
            autoComplete="new-password"
          />
        </div>

        {isMonnify && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700">Contract Code</label>
            <input
              value={form.contract_code}
              onChange={(e) => set('contract_code', e.target.value)}
              placeholder="Monnify contract code"
              className="border border-gray-200 rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
        )}

        <div className="flex items-center gap-6 pt-1">
          <Toggle checked={!!form.is_active} onChange={(v) => set('is_active', v)} label="Active" />
          <Toggle checked={!!form.is_default} onChange={(v) => set('is_default', v)} label="Default" />
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          Secret keys are encrypted at rest and never shown again.
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93636] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? 'Save Changes' : 'Add Gateway')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentGatewaysTab() {
  const { data: gateways = [], isLoading } = useAdminGateways();
  const del = useDeleteGateway();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentGateway | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (gw: PaymentGateway) => { setEditing(gw); setModalOpen(true); };

  const remove = async (gw: PaymentGateway) => {
    if (!confirm(`Delete the ${gw.display_name} (${gw.mode}) gateway?`)) return;
    try {
      await del.mutateAsync(gw.id);
      toast.success('Gateway deleted.');
    } catch {
      toast.error('Failed to delete gateway.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-red-50 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-[#E03E3E]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Payment Gateways</h2>
            <p className="text-xs text-gray-500">Customers can pay through any active gateway.</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#c93636]"
        >
          <Plus className="w-4 h-4" /> Add Gateway
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-md animate-pulse" />)}
        </div>
      ) : gateways.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-md p-8 text-center text-sm text-gray-400">
          No gateways configured yet. Add one to start accepting payments.
        </div>
      ) : (
        <div className="grid gap-3">
          {gateways.map((gw) => (
            <div key={gw.id} className="border border-gray-100 rounded-md shadow-sm p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{gw.display_name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{gw.provider}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{gw.mode}</span>
                  {gw.is_active
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Active</span>
                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inactive</span>}
                  {gw.is_default && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E03E3E]/10 text-[#E03E3E]">Default</span>}
                </div>
                <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                  {clientKeyLabel(gw.provider)}: {gw.client_key || '—'} · Secret: {gw.has_secret_key ? gw.secret_key_hint : 'not set'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(gw)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:text-[#E03E3E] hover:border-[#E03E3E]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(gw)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <GatewayModal gateway={editing} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
