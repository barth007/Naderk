'use client';

import React, { use, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Pencil, Trash2, Mail, Phone, MapPin, Calendar, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toastApiError } from '@/lib/api-errors';
import {
  useAdminStaffDetail,
  useAdminUpdateStaff,
  useAdminToggleStaff,
  useAdminDeleteStaff,
  StaffDetail,
  UpdateStaffInput,
} from '@/services/admin/admin-staff.hooks';
import { useAdminDepartments } from '@/services/admin/admin-departments.hooks';
import { useSpecializations } from '@/services/admin/admin-specializations.hooks';

const ROLE_LABELS: Record<string, string> = {
  DOCTOR: 'Doctor',
  OPTICIAN: 'Optician',
  MEDICAL_AGENT: 'Medical Agent',
  OPERATIONS_MANAGER: 'Operations Manager',
  AGENT: 'Support Agent',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

const HISTORY_LABELS: Record<keyof StaffDetail['history'], string> = {
  appointments: 'appointments',
  telehealth_sessions: 'telehealth sessions',
  consultations: 'consultations',
  prescriptions: 'prescriptions',
  orders: 'orders',
};

const inputCls =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

function fmtDate(value: string | null, pattern = 'MMM d, yyyy') {
  return value ? format(new Date(value), pattern) : '—';
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{value || '—'}</p>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return <img src={src} alt={name} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />;
  }
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-16 h-16 rounded-full bg-[#E03E3E] text-white text-lg font-semibold flex items-center justify-center">
      {initials || '?'}
    </div>
  );
}

function EditForm({ staff, onDone }: { staff: StaffDetail; onDone: () => void }) {
  const { mutate: updateStaff, isPending } = useAdminUpdateStaff(staff.id);
  const { data: departments = [] } = useAdminDepartments();
  const { data: specializations = [] } = useSpecializations();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    first_name: staff.first_name,
    last_name: staff.last_name,
    phone_number: staff.phone,
    department: staff.department,
    office_address: staff.office_address,
    employment_date: staff.employment_date ?? '',
    specialization: staff.doctor?.specialization ?? '',
    license_number: staff.doctor?.license_number ?? '',
    years_experience: String(staff.doctor?.years_experience ?? 0),
    consultation_fee: staff.doctor?.consultation_fee ?? '',
    bio: staff.doctor?.bio ?? '',
    is_accepting_patients: staff.doctor?.is_accepting_patients ?? true,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  function handleSave() {
    if (!form.first_name.trim()) {
      setErrors({ first_name: 'First name is required.' });
      return;
    }
    const payload: UpdateStaffInput = {
      first_name: form.first_name,
      last_name: form.last_name,
      phone_number: form.phone_number,
      department: form.department,
      office_address: form.office_address,
      employment_date: form.employment_date || null,
    };
    if (staff.doctor) {
      Object.assign(payload, {
        specialization: form.specialization,
        license_number: form.license_number,
        years_experience: Number(form.years_experience) || 0,
        consultation_fee: form.consultation_fee || 0,
        bio: form.bio,
        is_accepting_patients: form.is_accepting_patients,
      });
    }
    updateStaff(payload, {
      onSuccess: () => { toast.success('Profile updated.'); onDone(); },
      onError: (err) => {
        const info = toastApiError(err, 'Failed to update profile.');
        setErrors(info.fieldErrors);
      },
    });
  }

  const err = (k: string) => errors[k] && <p className="text-xs text-red-600 mt-1">{errors[k]}</p>;

  return (
    <Card className="rounded-md border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-4">Edit profile</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">First name</span>
          <input className={inputCls} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
          {err('first_name')}
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Last name</span>
          <input className={inputCls} value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Phone</span>
          <input className={inputCls} value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Department</span>
          <select className={inputCls} value={form.department} onChange={(e) => set('department', e.target.value)}>
            <option value="">—</option>
            {form.department && !departments.some((d) => d.name === form.department) && (
              <option value={form.department}>{form.department}</option>
            )}
            {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Office address</span>
          <input className={inputCls} value={form.office_address} onChange={(e) => set('office_address', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Employment date</span>
          <input type="date" className={inputCls} value={form.employment_date} onChange={(e) => set('employment_date', e.target.value)} />
        </label>

        {staff.doctor && (
          <>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Specialization</span>
              <select className={inputCls} value={form.specialization} onChange={(e) => set('specialization', e.target.value)}>
                {specializations.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              {err('specialization')}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">License number</span>
              <input className={inputCls} value={form.license_number} onChange={(e) => set('license_number', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Years of experience</span>
              <input type="number" min={0} className={inputCls} value={form.years_experience} onChange={(e) => set('years_experience', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Consultation fee</span>
              <input type="number" min={0} step="0.01" className={inputCls} value={form.consultation_fee} onChange={(e) => set('consultation_fee', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-gray-600">Bio</span>
              <textarea rows={3} className={inputCls} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={form.is_accepting_patients} onChange={(e) => set('is_accepting_patients', e.target.checked)} />
              <span className="text-sm text-gray-700">Accepting new patients</span>
            </label>
          </>
        )}
      </div>
      <div className="flex gap-3 justify-end mt-6">
        <button
          onClick={onDone}
          disabled={isPending}
          className="px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-[#E03E3E] text-white text-sm font-semibold hover:bg-[#c93535] disabled:opacity-60 flex items-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </Card>
  );
}

function StaffDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: staff, isLoading, isError } = useAdminStaffDetail(id);
  const { mutate: toggleStaff, isPending: isToggling } = useAdminToggleStaff();
  const { mutate: deleteStaff, isPending: isDeleting } = useAdminDeleteStaff();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Loading staff member...</p>
      </div>
    );
  }

  if (isError || !staff) {
    return (
      <div className="p-6">
        <Link href="/admin/staff" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Back to staff
        </Link>
        <p className="mt-6 text-sm text-gray-500">This staff member could not be found.</p>
      </div>
    );
  }

  function handleToggle() {
    if (!staff) return;
    toggleStaff(staff.id, {
      onSuccess: () => toast.success(`${staff.name} ${staff.is_active ? 'deactivated' : 'activated'}.`),
      onError: (err) => toastApiError(err, 'Failed to update status.'),
    });
  }

  function handleDelete() {
    if (!staff) return;
    deleteStaff(staff.id, {
      onSuccess: () => { toast.success(`${staff.name} deleted.`); router.replace('/admin/staff'); },
      onError: (err) => { toastApiError(err, 'Failed to delete staff member.'); setConfirmDelete(false); },
    });
  }

  const blockers = (Object.keys(staff.history) as (keyof StaffDetail['history'])[])
    .filter((k) => staff.history[k] > 0)
    .map((k) => `${staff.history[k]} ${HISTORY_LABELS[k]}`);

  return (
    <div className="p-6 flex flex-col gap-5 max-w-screen-lg">
      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete staff member?"
        description={`${staff.name} will be permanently removed. This cannot be undone.`}
        confirmText="Delete"
        isPending={isDeleting}
        confirmButtonVariant="destructive"
      />

      <Link href="/admin/staff" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to staff
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Avatar name={staff.name} src={staff.avatar} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
            <p className="text-sm text-gray-500">
              {ROLE_LABELS[staff.role] ?? staff.role}
              {staff.doctor?.specialization_display ? ` · ${staff.doctor.specialization_display}` : ''}
              {' · '}ID {staff.employee_id}
            </p>
            <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${staff.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {staff.is_active ? 'Active' : 'Deactivated'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              <Pencil className="w-4 h-4" /> Edit profile
            </button>
          )}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
          >
            {staff.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!staff.can_delete}
            title={staff.can_delete ? 'Delete' : 'Has records on file — deactivate instead'}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {!staff.can_delete && (
        <p className="text-xs text-gray-500 -mt-2">
          Can&apos;t be deleted: {blockers.join(', ')} on record. Deactivate this account instead.
        </p>
      )}

      {editing ? (
        <EditForm staff={staff} onDone={() => setEditing(false)} />
      ) : (
        <>
          <Card className="rounded-md border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Contact & employment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Email" value={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{staff.email}</span>} />
              <Field label="Phone" value={staff.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{staff.phone}</span>} />
              <Field label="Department" value={staff.department} />
              <Field label="Office address" value={staff.office_address && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{staff.office_address}</span>} />
              <Field label="Employment date" value={staff.employment_date && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{fmtDate(staff.employment_date)}</span>} />
              <Field label="Last login" value={staff.last_login && <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />{fmtDate(staff.last_login, 'MMM d, yyyy h:mm a')}</span>} />
              <Field label="Account created" value={fmtDate(staff.date_joined)} />
            </div>
          </Card>

          {staff.doctor && (
            <Card className="rounded-md border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Clinical profile</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <Field label="Specialization" value={staff.doctor.specialization_display} />
                <Field label="License number" value={staff.doctor.license_number} />
                <Field label="Years of experience" value={String(staff.doctor.years_experience)} />
                <Field label="Consultation fee" value={staff.doctor.consultation_fee} />
                <Field label="Accepting patients" value={staff.doctor.is_accepting_patients ? 'Yes' : 'No'} />
                <Field label="Availability" value={staff.doctor.availability_status} />
                <div className="sm:col-span-2"><Field label="Bio" value={staff.doctor.bio} /></div>
              </div>
            </Card>
          )}

          <Card className="rounded-md border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Activity on record</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {(Object.keys(staff.history) as (keyof StaffDetail['history'])[]).map((k) => (
                <div key={k}>
                  <p className="text-2xl font-bold text-gray-900">{staff.history[k]}</p>
                  <p className="text-xs text-gray-400 capitalize">{HISTORY_LABELS[k]}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AdminStaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
        </div>
      }
    >
      <StaffDetailContent id={id} />
    </Suspense>
  );
}
