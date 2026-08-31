'use client';

import React, { useState } from 'react';
import { X, UserPlus, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-errors';
import { useCreatePatient } from '@/services/admin/admin-appointments.hooks';

/**
 * Register a walk-in patient from the desk.
 *
 * The dashboard's "New Patient Record" action linked at /admin/records/new,
 * which is not a route — it matched /admin/records/[id] and tried to load a
 * patient called "new", reporting "unable to access medical records". Nothing
 * could create a patient either.
 */
export default function NewPatientModal({
  isOpen, onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreatePatient();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    if (fieldErrors[k]) setFieldErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const close = () => {
    setForm({ first_name: '', last_name: '', email: '', phone_number: '' });
    setFieldErrors({});
    onClose();
  };

  const submit = () => {
    setFieldErrors({});
    create.mutate(form, {
      onSuccess: (p) => {
        toast.success(`${p.name} registered — ${p.patient_id}`, {
          description: p.invite_sent
            // The desk can use the account either way, so a failed email is
            // reported rather than treated as a failed registration.
            ? 'An invite to set their password has been emailed.'
            : 'Could not send the invite email — share the password reset link manually.',
        });
        close();
      },
      onError: (e) => {
        const { fieldErrors: fe } = toastApiError(e, 'Could not register this patient.');
        setFieldErrors(fe);
      },
    });
  };

  if (!isOpen) return null;

  const input = (k: keyof typeof form, label: string, placeholder: string, type = 'text') => (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{label}</label>
      <input
        type={type}
        value={form[k]}
        onChange={e => set(k, e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 ${
          fieldErrors[k] ? 'border-red-400' : 'border-gray-200'
        }`}
      />
      {fieldErrors[k] && <p className="text-[11px] text-red-500 mt-1">{fieldErrors[k]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative z-10">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-[#E03E3E]" />
            <div>
              <h3 className="font-bold text-base text-gray-900 leading-tight">New Patient</h3>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Register a walk-in at the desk</p>
            </div>
          </div>
          <button onClick={close} aria-label="Close"
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {input('first_name', 'First name', 'Emma')}
            {input('last_name', 'Last name', 'Turner')}
          </div>
          {input('email', 'Email', 'patient@example.com', 'email')}
          {input('phone_number', 'Phone', '+234…', 'tel')}

          <p className="text-[11px] text-gray-400 leading-relaxed">
            The patient is emailed a link to set their own password. They can book
            and see their records as soon as they do.
          </p>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={close}
            className="border border-gray-200 bg-white text-gray-600 text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={create.isPending || !form.first_name.trim() || !form.email.trim()}
            className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Register Patient
          </button>
        </div>
      </div>
    </div>
  );
}
