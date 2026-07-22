'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Power, Loader2, X, CheckCircle2, AlertCircle, Clock, Stethoscope, UserCheck, FlaskConical, Video } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  useAdminServices,
  useAdminCreateService,
  useAdminUpdateService,
  useAdminToggleService,
  AdminService,
  BillingType,
  BILLING_LABELS,
  CreateServicePayload,
} from '@/services/admin/admin-services.hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  { value: 'GENERAL_PRACTICE',       label: 'General Practice' },
  { value: 'PEDIATRICS',             label: 'Pediatrics' },
  { value: 'CARDIOLOGY',             label: 'Cardiology' },
  { value: 'DERMATOLOGY',            label: 'Dermatology' },
  { value: 'NEUROLOGY',              label: 'Neurology' },
  { value: 'ONCOLOGY',               label: 'Oncology' },
  { value: 'ORTHOPEDICS',            label: 'Orthopedics' },
  { value: 'PSYCHIATRY',             label: 'Psychiatry' },
  { value: 'RADIOLOGY',              label: 'Radiology' },
  { value: 'SURGERY',                label: 'Surgery' },
  { value: 'UROLOGY',                label: 'Urology' },
  { value: 'OPHTHALMOLOGY',          label: 'Ophthalmology' },
  { value: 'OPTOMETRY',              label: 'Optometry' },
  { value: 'EMERGENCY_MEDICINE',     label: 'Emergency Medicine' },
  { value: 'INTERNAL_MEDICINE',      label: 'Internal Medicine' },
  { value: 'OBSTETRICS_GYNECOLOGY',  label: 'Obstetrics & Gynecology' },
  { value: 'ANESTHESIOLOGY',         label: 'Anesthesiology' },
  { value: 'PATHOLOGY',              label: 'Pathology' },
  { value: 'PHYSIOTHERAPY',          label: 'Physiotherapy' },
  { value: 'LABORATORY_MEDICINE',    label: 'Laboratory Medicine' },
];

const BILLING_OPTIONS: { value: BillingType; label: string; hint: string }[] = [
  { value: 'PER_VISIT',    label: 'Per Visit',           hint: 'Patient pays each time they book.' },
  { value: 'MONTHLY',      label: 'Monthly (unlimited)', hint: 'Patient pays once per month, unlimited sessions.' },
  { value: 'SESSION_PACK', label: 'Session Pack',        hint: 'Patient buys a pack of N sessions upfront.' },
];

const EMPTY_FORM: CreateServicePayload & { id?: string } = {
  name: '',
  description: '',
  requires_doctor: true,
  available_online: false,
  required_specialization: '',
  duration_minutes: 30,
  buffer_time_before: 0,
  buffer_time_after: 5,
  fee: '',
  billing_type: 'PER_VISIT',
  sessions_included: undefined,
  is_active: true,
};

// ─── Service Form Modal ───────────────────────────────────────────────────────

function ServiceFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: AdminService;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!initial;
  const { mutate: create, isPending: creating } = useAdminCreateService();
  const { mutate: update, isPending: updating } = useAdminUpdateService();
  const isPending = creating || updating;

  const [form, setForm] = useState<CreateServicePayload & { id?: string }>(
    initial
      ? {
          id: initial.id,
          name: initial.name,
          description: initial.description,
          requires_doctor: initial.requires_doctor,
          available_online: initial.available_online,
          required_specialization: initial.required_specialization ?? '',
          duration_minutes: initial.duration_minutes,
          buffer_time_before: initial.buffer_time_before,
          buffer_time_after: initial.buffer_time_after,
          fee: initial.fee,
          billing_type: initial.billing_type,
          sessions_included: initial.sessions_included ?? undefined,
          is_active: initial.is_active,
        }
      : { ...EMPTY_FORM },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setF<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key as string]) setErrors((p) => { const e = { ...p }; delete e[key as string]; return e; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Service name is required.';
    if (form.requires_doctor && !form.required_specialization)
      e.required_specialization = 'Specialization is required when a doctor is needed.';
    if (!form.fee || isNaN(parseFloat(form.fee as string))) e.fee = 'Valid fee is required.';
    if (!form.billing_type) e.billing_type = 'Billing type is required.';
    if (form.billing_type === 'SESSION_PACK' && (!form.sessions_included || form.sessions_included < 1))
      e.sessions_included = 'Number of sessions is required for Session Pack.';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const payload: CreateServicePayload & { id?: string } = {
      ...form,
      required_specialization: form.requires_doctor ? (form.required_specialization || undefined) : undefined,
    };
    if (payload.billing_type !== 'SESSION_PACK') delete payload.sessions_included;

    if (isEdit && form.id) {
      update(
        { id: form.id, ...payload },
        {
          onSuccess: () => { onSaved('Service updated successfully.'); onClose(); },
          onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setErrors({ _form: msg || 'Failed to update service.' });
          },
        },
      );
    } else {
      create(payload, {
        onSuccess: () => { onSaved('Service created successfully.'); onClose(); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          setErrors({ _form: msg || 'Failed to create service.' });
        },
      });
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="rounded-xl border border-gray-100 shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-[#E03E3E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Service' : 'New Service'}</h3>
              <p className="text-xs text-gray-400">{isEdit ? 'Update service details' : 'Create a new clinical service'}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Service Name *</label>
            <input value={form.name} onChange={(e) => setF('name', e.target.value)} className={inputCls} placeholder="e.g. Comprehensive Eye Exam" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setF('description', e.target.value)}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Brief description shown to patients"
            />
          </div>

          {/* Requires Doctor toggle */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">Service Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center gap-2.5 border rounded-md px-3 py-2.5 cursor-pointer transition-colors ${form.requires_doctor ? 'border-[#E03E3E] bg-red-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="requires_doctor"
                  checked={!!form.requires_doctor}
                  onChange={() => setF('requires_doctor', true)}
                  className="accent-[#E03E3E]"
                />
                <UserCheck className="w-4 h-4 text-[#E03E3E]" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">Requires Doctor</p>
                  <p className="text-xs text-gray-400">Consultation, exam, etc.</p>
                </div>
              </label>
              <label className={`flex items-center gap-2.5 border rounded-md px-3 py-2.5 cursor-pointer transition-colors ${!form.requires_doctor ? 'border-[#E03E3E] bg-red-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="requires_doctor"
                  checked={!form.requires_doctor}
                  onChange={() => { setF('requires_doctor', false); setF('available_online', false); setF('required_specialization', ''); }}
                  className="accent-[#E03E3E]"
                />
                <FlaskConical className="w-4 h-4 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">Facility-Based</p>
                  <p className="text-xs text-gray-400">Lab test, imaging, etc.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Online availability — only when requires_doctor */}
          {form.requires_doctor && (
            <div>
              <label className="flex items-center gap-3 border border-gray-200 rounded-md px-3 py-2.5 cursor-pointer hover:border-gray-300 transition-colors">
                <input
                  type="checkbox"
                  checked={!!form.available_online}
                  onChange={(e) => setF('available_online', e.target.checked)}
                  className="w-4 h-4 accent-[#E03E3E] rounded"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-800">Also available online (Telehealth)</p>
                  <p className="text-xs text-gray-400">Patients can choose between physical visit or video call</p>
                </div>
              </label>
            </div>
          )}

          {/* Specialization — only shown when requires_doctor */}
          {form.requires_doctor && (
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Required Specialization *</label>
              <select value={form.required_specialization ?? ''} onChange={(e) => setF('required_specialization', e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Select specialization</option>
                {SPECIALIZATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {errors.required_specialization && <p className="text-xs text-red-500 mt-1">{errors.required_specialization}</p>}
            </div>
          )}

          {/* Duration + Buffer */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Duration (min)</label>
              <input type="number" min={5} value={form.duration_minutes} onChange={(e) => setF('duration_minutes', parseInt(e.target.value) || 30)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Buffer Before</label>
              <input type="number" min={0} value={form.buffer_time_before} onChange={(e) => setF('buffer_time_before', parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Buffer After</label>
              <input type="number" min={0} value={form.buffer_time_after} onChange={(e) => setF('buffer_time_after', parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
          </div>

          {/* Billing Type */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">Billing Type *</label>
            <div className="space-y-2">
              {BILLING_OPTIONS.map((opt) => (
                <label key={opt.value} className={`flex items-start gap-3 border rounded-md px-3 py-2.5 cursor-pointer transition-colors ${form.billing_type === opt.value ? 'border-[#E03E3E] bg-red-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="billing_type"
                    value={opt.value}
                    checked={form.billing_type === opt.value}
                    onChange={() => setF('billing_type', opt.value)}
                    className="mt-0.5 accent-[#E03E3E]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            {errors.billing_type && <p className="text-xs text-red-500 mt-1">{errors.billing_type}</p>}
          </div>

          {/* Sessions (SESSION_PACK only) */}
          {form.billing_type === 'SESSION_PACK' && (
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Sessions per Pack *</label>
              <input
                type="number" min={1}
                value={form.sessions_included ?? ''}
                onChange={(e) => setF('sessions_included', parseInt(e.target.value) || undefined)}
                className={inputCls}
                placeholder="e.g. 10"
              />
              {errors.sessions_included && <p className="text-xs text-red-500 mt-1">{errors.sessions_included}</p>}
            </div>
          )}

          {/* Fee */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Fee (₦) *
              {form.billing_type === 'MONTHLY' && <span className="text-gray-400 font-normal ml-1">— per month</span>}
              {form.billing_type === 'SESSION_PACK' && <span className="text-gray-400 font-normal ml-1">— per pack</span>}
              {form.billing_type === 'PER_VISIT' && <span className="text-gray-400 font-normal ml-1">— per visit</span>}
            </label>
            <input
              type="number" min={0}
              value={form.fee}
              onChange={(e) => setF('fee', e.target.value)}
              className={inputCls}
              placeholder="e.g. 15000"
            />
            {errors.fee && <p className="text-xs text-red-500 mt-1">{errors.fee}</p>}
          </div>

          {errors._form && <p className="text-xs text-red-500">{errors._form}</p>}
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Create Service'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onEdit,
  onToggle,
}: {
  service: AdminService;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <Card className={`p-4 border rounded-xl transition-opacity ${service.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${service.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <h3 className="text-sm font-bold text-gray-900 truncate">{service.name}</h3>
          </div>
          {service.description && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{service.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {service.requires_doctor ? (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                <UserCheck className="w-3 h-3" />
                {service.required_specialization
                  ? service.required_specialization.charAt(0) + service.required_specialization.slice(1).toLowerCase().replace(/_/g, ' ')
                  : 'Doctor required'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                <FlaskConical className="w-3 h-3" />
                Facility-based
              </span>
            )}
            {service.requires_doctor && service.available_online && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                <Video className="w-3 h-3" />
                Online available
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              <Clock className="w-3 h-3" />
              {service.duration_minutes} min
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {BILLING_LABELS[service.billing_type]}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-gray-900">₦{parseFloat(service.fee).toLocaleString()}</p>
          <p className="text-xs text-gray-400">
            {service.billing_type === 'PER_VISIT' && 'per visit'}
            {service.billing_type === 'MONTHLY' && 'per month'}
            {service.billing_type === 'SESSION_PACK' && `${service.sessions_included} sessions`}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          onClick={onToggle}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors ${service.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
        >
          <Power className="w-3.5 h-3.5" />
          {service.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </Card>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg text-sm font-medium ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
      <button onClick={onDismiss} className="ml-1 opacity-75 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminServicesPage() {
  const { data: services = [], isLoading } = useAdminServices();
  const { mutate: toggleService } = useAdminToggleService();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminService | undefined>();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleToggle(service: AdminService) {
    toggleService(
      { id: service.id, is_active: !service.is_active },
      {
        onSuccess: () => showToast(`Service ${service.is_active ? 'deactivated' : 'activated'}.`),
        onError: () => showToast('Failed to update service.', 'error'),
      },
    );
  }

  const filtered = services.filter((s) =>
    filter === 'all' ? true : filter === 'active' ? s.is_active : !s.is_active,
  );

  const activeCount   = services.filter((s) => s.is_active).length;
  const inactiveCount = services.filter((s) => !s.is_active).length;

  return (
    <div className="p-6 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Medical Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#E03E3E] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#c93535] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Service
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter === f ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No services found</p>
          <p className="text-xs mt-1">Create your first service to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => { setEditing(service); setShowForm(true); }}
              onToggle={() => handleToggle(service)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <ServiceFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
