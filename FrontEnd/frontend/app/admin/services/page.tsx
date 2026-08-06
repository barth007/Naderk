'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Power, Loader2, X, Clock, Stethoscope, UserCheck, FlaskConical, Video, Trash2, Settings2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  useSpecializations,
  useCreateSpecialization,
  useUpdateSpecialization,
  useDeleteSpecialization,
  Specialization,
} from '@/services/admin/admin-specializations.hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

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
  const { data: specializations = [], isLoading: loadingSpecs } = useSpecializations();
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

    // Map an API error onto per-field errors when the backend tags them, else a form-level error
    const applyApiError = (err: unknown, fallback: string) => {
      const res = (err as { response?: { data?: { detail?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const fieldErrors = res?.errors;
      if (fieldErrors && Object.keys(fieldErrors).length) {
        const mapped: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(fieldErrors)) {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        }
        setErrors(mapped);
      } else {
        setErrors({ _form: res?.detail || fallback });
      }
    };

    if (isEdit && form.id) {
      update(
        { id: form.id, ...payload },
        {
          onSuccess: () => { onSaved('Service updated successfully.'); onClose(); },
          onError: (err: unknown) => applyApiError(err, 'Failed to update service.'),
        },
      );
    } else {
      create(payload, {
        onSuccess: () => { onSaved('Service created successfully.'); onClose(); },
        onError: (err: unknown) => applyApiError(err, 'Failed to create service.'),
      });
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';
  const selectedSpec = specializations.find((s) => s.code === form.required_specialization);

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
              <select
                value={form.required_specialization ?? ''}
                onChange={(e) => setF('required_specialization', e.target.value)}
                disabled={loadingSpecs}
                className={`${inputCls} bg-white disabled:opacity-50`}
              >
                <option value="">{loadingSpecs ? 'Loading…' : 'Select specialization'}</option>
                {specializations.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
              </select>
              {!loadingSpecs && specializations.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No specializations configured yet — add one from &ldquo;Manage Specializations&rdquo;.
                </p>
              )}
              {/* A service whose specialization no doctor holds can never have a
                  specialist assigned — patients just see "no specialist available"
                  on every date. Surface that here rather than at booking time. */}
              {selectedSpec && selectedSpec.doctor_count === 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span>
                    No doctor currently has this specialization, so no specialist can be
                    assigned. Set a doctor&apos;s specialization to <strong>{selectedSpec.name}</strong> under
                    Staff, or pick a different one.
                  </span>
                </p>
              )}
              {selectedSpec && selectedSpec.doctor_count > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {selectedSpec.doctor_count} doctor{selectedSpec.doctor_count === 1 ? '' : 's'} available for this specialization.
                </p>
              )}
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
  isToggling,
  specializationLabel,
}: {
  service: AdminService;
  onEdit: () => void;
  onToggle: () => void;
  isToggling: boolean;
  specializationLabel: string | null;
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
                {specializationLabel ?? 'Doctor required'}
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
          disabled={isToggling}
          aria-label={`${service.is_active ? 'Deactivate' : 'Activate'} ${service.name}`}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${service.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
        >
          {isToggling
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Power className="w-3.5 h-3.5" />}
          {service.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </Card>
  );
}

// ─── Manage Specializations Modal ─────────────────────────────────────────────

function ManageSpecializationsModal({ onClose }: { onClose: () => void }) {
  // Inactive rows are shown here so an admin can see and reactivate them.
  const { data: specs = [], isLoading } = useSpecializations(true);
  const { mutate: create, isPending: creating } = useCreateSpecialization();
  const { mutate: update } = useUpdateSpecialization();
  const { mutate: remove } = useDeleteSpecialization();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const apiDetail = (err: unknown) =>
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    create(
      { name, description: newDesc.trim() || undefined },
      {
        onSuccess: (spec) => {
          toast.success(`"${spec.name}" added.`, {
            description: `Doctors and services can now use it. Code: ${spec.code}`,
          });
          setNewName('');
          setNewDesc('');
        },
        onError: (err) => toast.error('Could not add specialization.', { description: apiDetail(err) }),
      },
    );
  }

  function handleRename(spec: Specialization) {
    const name = editName.trim();
    if (!name) return;
    update(
      { id: spec.id, name },
      {
        onSuccess: () => { toast.success('Specialization renamed.'); setEditingId(null); },
        onError: (err) => toast.error('Could not rename.', { description: apiDetail(err) }),
      },
    );
  }

  function handleToggleActive(spec: Specialization) {
    update(
      { id: spec.id, is_active: !spec.is_active },
      {
        onSuccess: () => toast.success(spec.is_active ? `"${spec.name}" deactivated.` : `"${spec.name}" reactivated.`),
        onError: (err) => toast.error('Could not update.', { description: apiDetail(err) }),
      },
    );
  }

  function handleDelete(spec: Specialization) {
    remove(spec.id, {
      onSuccess: () => toast.success(`"${spec.name}" removed.`),
      onError: (err) =>
        toast.error('Could not remove.', {
          description: apiDetail(err) || 'It may still be assigned to doctors or services.',
        }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="rounded-xl border border-gray-100 shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-[#E03E3E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Manage Specializations</h3>
              <p className="text-xs text-gray-400">Used by services, doctor profiles, and onboarding</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Add */}
        <div className="space-y-2 pb-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-700">Add Specialization</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Retina Specialist"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="w-full bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</> : <><Plus className="w-4 h-4" /> Add Specialization</>}
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 pt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
          ) : specs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No specializations yet.</p>
          ) : (
            specs.map((spec) => (
              <div
                key={spec.id}
                className={`border border-gray-100 rounded-md px-3 py-2.5 ${spec.is_active ? '' : 'opacity-60'}`}
              >
                {editingId === spec.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(spec)}
                      autoFocus
                      className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20"
                    />
                    <button onClick={() => handleRename(spec)} className="text-xs font-semibold text-[#E03E3E] px-2">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-gray-500 px-2">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{spec.name}</p>
                      <p className="text-xs text-gray-400">
                        <code>{spec.code}</code>
                        {spec.in_use > 0 && ` · used by ${spec.in_use}`}
                        {!spec.is_active && ' · inactive'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(spec.id); setEditName(spec.name); }}
                        title="Rename"
                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(spec)}
                        title={spec.is_active ? 'Deactivate' : 'Reactivate'}
                        className={`p-1.5 rounded-md ${spec.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(spec)}
                        disabled={spec.in_use > 0}
                        title={spec.in_use > 0 ? 'Still assigned to doctors or services' : 'Remove'}
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
          The code is what booking matches on, so it can&apos;t be changed after creation. Renaming is safe.
        </p>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminServicesPage() {
  const { data: services = [], isLoading } = useAdminServices();
  const { mutate: toggleService } = useAdminToggleService();

  const { data: specializations = [] } = useSpecializations(true);

  const [showForm, setShowForm] = useState(false);
  const [showSpecializations, setShowSpecializations] = useState(false);
  const [editing, setEditing] = useState<AdminService | undefined>();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const specNameByCode = new Map(specializations.map((s) => [s.code, s.name]));

  function handleToggle(service: AdminService) {
    const nextActive = !service.is_active;
    setTogglingId(service.id);
    toggleService(
      { id: service.id, is_active: nextActive },
      {
        onSuccess: () =>
          toast.success(
            nextActive ? `"${service.name}" activated.` : `"${service.name}" deactivated.`,
            {
              description: nextActive
                ? 'Patients can now book this service.'
                : 'Patients can no longer book this service.',
            },
          ),
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.error(
            `Could not ${nextActive ? 'activate' : 'deactivate'} "${service.name}".`,
            { description: detail || 'Please try again.' },
          );
        },
        onSettled: () => setTogglingId(null),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Medical Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSpecializations(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Settings2 className="w-4 h-4" /> Specializations
          </button>
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 bg-[#E03E3E] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#c93535] transition-colors"
          >
            <Plus className="w-4 h-4" /> New Service
          </button>
        </div>
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
              isToggling={togglingId === service.id}
              specializationLabel={
                service.required_specialization
                  ? specNameByCode.get(service.required_specialization) ?? service.required_specialization
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ServiceFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={(msg) => toast.success(msg)}
        />
      )}
      {showSpecializations && (
        <ManageSpecializationsModal onClose={() => setShowSpecializations(false)} />
      )}
    </div>
  );
}
