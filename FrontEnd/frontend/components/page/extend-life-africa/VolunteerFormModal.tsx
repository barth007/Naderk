'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, HandHeart, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/api-errors';
import {
  useVolunteerApply, type SessionFormat, type VolunteerRole,
} from '@/services/donations/donations.hooks';

export const VOLUNTEER_ROLES: { value: VolunteerRole; label: string }[] = [
  { value: 'GP', label: 'GP' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'NUTRITIONIST', label: 'Nutritionist' },
];

const FORMATS: { value: SessionFormat; label: string; hint: string }[] = [
  { value: '4x15', label: '4 × 15 min', hint: 'Short consultations' },
  { value: '3x20', label: '3 × 20 min', hint: 'Longer consultations' },
];

const EMPTY = {
  full_name: '', email: '', phone: '', country: '', registration_number: '', message: '',
};

/**
 * "Offer your time": a volunteer application, saved for staff to review in
 * Admin → Extend Life Africa. The parent mounts it only while open, so every
 * opening starts from a clean form.
 */
export function VolunteerFormModal({
  initialRole, onClose,
}: {
  initialRole: VolunteerRole | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const apply = useVolunteerApply();
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    full_name: user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '',
    email: user?.email ?? '',
  }));
  const [role, setRole] = useState<VolunteerRole | null>(initialRole);
  const [format, setFormat] = useState<SessionFormat>('4x15');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const set = (k: keyof typeof EMPTY, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local: Record<string, string> = {};
    if (!form.full_name.trim()) local.full_name = 'Please tell us your name.';
    if (!form.email.trim()) local.email = 'Please give an email address.';
    if (!role) local.role = 'Choose how you would like to help.';
    if (Object.keys(local).length) { setErrors(local); return; }

    apply.mutate(
      { ...form, role: role!, session_format: format },
      {
        onSuccess: () => setSent(true),
        onError: (err) => {
          const info = parseApiError(err, 'We could not send your application. Please try again.');
          setErrors(info.fieldErrors);
          setFormError(info.description ? `${info.title} ${info.description}` : info.title);
        },
      },
    );
  };

  const field = (k: keyof typeof EMPTY, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`vol-${k}`} className="text-[13px] font-semibold text-[#3D3D4E]">{label}</label>
      <input id={`vol-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)}
        ref={k === 'full_name' ? firstField : undefined}
        className={cn('min-h-11 rounded-xl border-[1.5px] px-3.5 text-[15px] outline-none focus:border-[var(--destructive)]',
          errors[k] ? 'border-red-400' : 'border-[#E7DEDE]')}
        {...props} />
      {errors[k] && <p className="text-xs text-red-600">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="vol-title"
        className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-[#F1E4E4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#FDE8EC] flex items-center justify-center">
              <HandHeart className="w-5 h-5 text-[var(--destructive)]" aria-hidden />
            </span>
            <div>
              <h2 id="vol-title" className="text-lg font-bold text-[#1A1A2E] leading-tight">Volunteer with Extend Life Africa</h2>
              <p className="text-xs text-[#6B6B7B] mt-0.5">One hour a week of virtual consultations</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#6B6B7B] hover:bg-[#F6F1F1]">
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3" aria-live="polite">
            <CheckCircle2 className="w-12 h-12 text-[var(--destructive)]" aria-hidden />
            <h3 className="text-xl font-bold text-[#1A1A2E]">Thank you for offering your time</h3>
            <p className="text-sm text-[#4A4A5A] max-w-sm">
              Your application has reached the team. We will be in touch by email to arrange a short call.
            </p>
            <button type="button" onClick={onClose}
              className="mt-3 min-h-11 px-6 rounded-xl bg-[var(--destructive)] text-white text-sm font-semibold">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="px-6 py-5 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-semibold text-[#3D3D4E] mb-1.5">I would like to help as a</legend>
              <div className="grid grid-cols-3 gap-2">
                {VOLUNTEER_ROLES.map((r) => (
                  <button key={r.value} type="button" aria-pressed={role === r.value}
                    onClick={() => { setRole(r.value); setErrors((e) => { const n = { ...e }; delete n.role; return n; }); }}
                    className={cn('min-h-11 rounded-xl border-[1.5px] text-sm font-semibold',
                      role === r.value ? 'border-[var(--destructive)] bg-[#FFF1F1] text-[#9B1C1C]' : 'border-[#E7DEDE] text-[#3D3D4E]')}>
                    {r.label}
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-xs text-red-600">{errors.role}</p>}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-semibold text-[#3D3D4E] mb-1.5">My hour would work best as</legend>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map((f) => (
                  <button key={f.value} type="button" aria-pressed={format === f.value} onClick={() => setFormat(f.value)}
                    className={cn('min-h-14 rounded-xl border-[1.5px] px-3 py-2 text-left',
                      format === f.value ? 'border-[var(--destructive)] bg-[#FFF1F1]' : 'border-[#E7DEDE]')}>
                    <span className="block text-sm font-bold text-[#1A1A2E]">{f.label}</span>
                    <span className="block text-xs text-[#6B6B7B]">{f.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('full_name', 'Full name', { autoComplete: 'name' })}
              {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
              {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel' })}
              {field('country', 'Country (optional)', { autoComplete: 'country-name' })}
            </div>
            {field('registration_number', 'Professional registration number (optional)', { placeholder: 'e.g. MDCN, GMC or NMC number' })}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vol-message" className="text-[13px] font-semibold text-[#3D3D4E]">Anything we should know? (optional)</label>
              <textarea id="vol-message" rows={3} value={form.message} onChange={(e) => set('message', e.target.value)}
                className="rounded-xl border-[1.5px] border-[#E7DEDE] px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--destructive)] resize-y" />
            </div>

            {formError && <p role="alert" className="text-sm text-[#9B1C1C] bg-[#FFF1F1] rounded-xl px-4 py-3">{formError}</p>}

            <button type="submit" disabled={apply.isPending}
              className="min-h-12 rounded-xl bg-[var(--destructive)] text-white text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {apply.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Send my application
            </button>
            <p className="text-xs text-[#6B6B7B] text-center -mt-1">We only use these details to arrange volunteering.</p>
          </form>
        )}
      </div>
    </div>
  );
}
