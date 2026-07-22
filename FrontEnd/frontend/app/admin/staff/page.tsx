'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Plus, Shield, CheckCircle2, AlertCircle, X,
  Loader2, UserPlus, Phone, MapPin,
  Pencil, Trash2, Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, Th, Td,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import {
  useAdminStaff,
  useAdminWeekSchedule,
  useAdminCreateStaff,
  useAdminToggleStaff,
  StaffMember,
  DaySchedule,
} from '@/services/admin/admin-staff.hooks';
import {
  useAdminDepartments,
  useAdminCreateDepartment,
  useAdminUpdateDepartment,
  useAdminDeleteDepartment,
  Department,
} from '@/services/admin/admin-departments.hooks';
import {
  useAdminPermissions,
  useAdminUpdatePermissions,
} from '@/services/admin/admin-permissions.hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const APPT_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: 'Clinic',
  TELEHEALTH: 'Telehealth',
  HOME_VISIT: 'Home Visit',
  FOLLOW_UP: 'Ward Rounds',
  EMERGENCY: 'Emergency',
  SURGERY: 'Surgery',
};

const ROLE_OPTIONS = [
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'OPTICIAN', label: 'Optician' },
  { value: 'MEDICAL_AGENT', label: 'Medical Agent' },
  { value: 'ADMIN', label: 'Admin' },
];

const ROLE_LABELS: Record<string, string> = {
  DOCTOR: 'Doctor',
  OPTICIAN: 'Optician',
  MEDICAL_AGENT: 'Medical Agent',
  ADMIN: 'Admin',
};

const AVATAR_COLORS = ['#E03E3E', '#38bdf8', '#1e293b', '#a3e635', '#f59e0b', '#8b5cf6'];

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';
interface ToastState { message: string; type: ToastType; id: number }

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {toast.message}
      <button onClick={onDismiss} className="ml-1 opacity-75 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, src, size = 'md', colorIndex = 0 }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg'; colorIndex?: number }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  if (src) {
    return <img src={src} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0 border-2 border-white`} />;
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white font-semibold text-white`} style={{ background: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length] }}>
      {initials || '?'}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StaffMember['status'] }) {
  const cfg = {
    ONLINE:     { label: 'Online',     dot: 'bg-green-500', text: 'text-green-700' },
    IN_SESSION: { label: 'In session', dot: 'bg-blue-500',  text: 'text-blue-700' },
    OFFLINE:    { label: 'Offline',    dot: 'bg-gray-400',  text: 'text-gray-500' },
  }[status];
  return (
    <span className={`flex items-center gap-1.5 text-sm font-semibold ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Avatar Stack ─────────────────────────────────────────────────────────────

function AvatarStack({ names, extra }: { names: string[]; extra: number }) {
  return (
    <div className="flex items-center">
      {names.map((name, i) => (
        <div key={i} className={i > 0 ? '-ml-2' : ''} style={{ zIndex: names.length - i }}>
          <Avatar name={name} size="sm" colorIndex={i} />
        </div>
      ))}
      {extra > 0 && (
        <div className="-ml-2 w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600" style={{ zIndex: 0 }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({ day }: { day: DaySchedule }) {
  const typeLabel = APPT_TYPE_LABELS[day.appointment_type] ?? day.appointment_type;
  const isEmpty = day.staff_count === 0;
  return (
    <div className={`border rounded-md p-3 min-w-[130px] flex-1 ${isEmpty ? 'border-gray-100 bg-gray-50/50' : 'border-gray-100 bg-white'}`}>
      <p className="text-xs text-gray-400 font-medium mb-1">{day.weekday}</p>
      {isEmpty ? (
        <p className="text-xs text-gray-300 mt-2">No appointments</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-0.5">{typeLabel}</p>
          <p className="text-sm font-bold text-gray-900 mb-2">{day.staff_count} Staff</p>
          <AvatarStack names={day.doctor_names} extra={day.extra_count} />
          <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">
            {day.doctor_names.slice(0, 2).join(', ')}
            {day.extra_count > 0 ? ` & ${day.extra_count} other${day.extra_count > 1 ? 's' : ''}` : ''}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Shift Progress ───────────────────────────────────────────────────────────

function ShiftProgress() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  let shiftName = 'Morning';
  let shiftStart = 8, shiftEnd = 14;
  if (hours >= 14) { shiftName = 'Afternoon'; shiftStart = 14; shiftEnd = 20; }
  if (hours >= 20) { shiftName = 'Night'; shiftStart = 20; shiftEnd = 32; }

  const totalMins = (shiftEnd - shiftStart) * 60;
  const elapsed = (hours - shiftStart) * 60 + minutes;
  const progress = Math.min(100, Math.max(0, (elapsed / totalMins) * 100));
  const remaining = Math.max(0, totalMins - elapsed);
  const remH = Math.floor(remaining / 60);
  const remM = remaining % 60;
  const endsText = remaining > 0 ? `Ends in ${remH > 0 ? `${remH}h ` : ''}${remM}m` : 'Shift ended';

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-700 mb-2">Current Shift Progress</p>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-800">{shiftName}</span>
        <span className="text-xs font-semibold text-[#E03E3E]">{endsText}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#E03E3E] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const { mutate: createStaff, isPending } = useAdminCreateStaff();
  const { data: departments = [] } = useAdminDepartments();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone_number: '',
    role: '', department: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required.';
    if (!form.email.trim()) newErrors.email = 'Email is required.';
    if (!form.role) newErrors.role = 'Please select a role.';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
    createStaff(
      {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number.trim() || undefined,
        role: form.role,
        department: form.department || undefined,
      },
      {
        onSuccess: () => { onSuccess('Staff member added successfully!'); onClose(); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setErrors({ _form: msg || 'Failed to create staff member.' });
        },
      }
    );
  }

  const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[480px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-4 h-4 text-[#E03E3E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Add New Staff</h3>
              <p className="text-xs text-gray-400">Create a new staff account</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">First Name *</label>
              <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className={inputCls} placeholder="e.g. Sarah" />
              {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Last Name</label>
              <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className={inputCls} placeholder="e.g. Doe" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Email Address *</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="sarah.doe@naderk.com" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Phone Number</label>
            <input value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} className={inputCls} placeholder="+234 0812 345 678" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Role *</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Department</label>
              <select value={form.department} onChange={(e) => set('department', e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          {errors._form && <p className="text-xs text-red-500">{errors._form}</p>}
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</> : 'Add Staff Member'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Manage Departments Modal ─────────────────────────────────────────────────

function ManageDepartmentsModal({ onClose, showToast }: { onClose: () => void; showToast: (msg: string, type: ToastType) => void }) {
  const { data: departments = [], isLoading } = useAdminDepartments();
  const { mutate: createDept, isPending: creating } = useAdminCreateDepartment();
  const { mutate: updateDept, isPending: updating } = useAdminUpdateDepartment();
  const { mutate: deleteDept } = useAdminDeleteDepartment();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

  function handleCreate() {
    if (!newName.trim()) return;
    createDept(
      { name: newName.trim(), description: newDesc.trim() || undefined },
      {
        onSuccess: () => { showToast('Department created.', 'success'); setNewName(''); setNewDesc(''); },
        onError: () => showToast('Failed to create department.', 'error'),
      }
    );
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditDesc(dept.description ?? '');
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    updateDept(
      { id: editingId, name: editName.trim(), description: editDesc.trim() || undefined },
      {
        onSuccess: () => { showToast('Department updated.', 'success'); setEditingId(null); },
        onError: () => showToast('Failed to update department.', 'error'),
      }
    );
  }

  function handleDelete(dept: Department) {
    if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
    deleteDept(dept.id, {
      onSuccess: () => showToast('Department deleted.', 'success'),
      onError: () => showToast('Failed to delete department.', 'error'),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[520px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-[#E03E3E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Manage Departments</h3>
              <p className="text-xs text-gray-400">Add, edit, or remove clinical departments</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Add new */}
        <div className="border border-dashed border-gray-200 rounded-md p-3 mb-4 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Add Department</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Department name"
              className={`${inputCls} flex-1`}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className={inputCls}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="w-full bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Department
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-md animate-pulse" />
            ))
          ) : departments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No departments yet.</p>
          ) : (
            departments.map((dept) => (
              <div key={dept.id} className="border border-gray-100 rounded-md p-3">
                {editingId === dept.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={updating}
                        className="flex-1 bg-[#E03E3E] text-white text-xs font-semibold py-1.5 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors"
                      >
                        {updating ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 border border-gray-200 text-gray-600 text-xs font-semibold py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{dept.name}</p>
                      {dept.description && <p className="text-xs text-gray-400 mt-0.5">{dept.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => startEdit(dept)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Manage Permissions Modal ─────────────────────────────────────────────────

function ManagePermissionsModal({ onClose, showToast }: { onClose: () => void; showToast: (msg: string, type: ToastType) => void }) {
  const { data: permsData, isLoading } = useAdminPermissions();
  const { mutate: updatePerms, isPending } = useAdminUpdatePermissions();
  const [selectedRole, setSelectedRole] = useState('DOCTOR');

  // Local mutable state for current role's permissions
  const [localPerms, setLocalPerms] = useState<Record<string, string[]>>({});

  // Initialise localPerms when data arrives
  React.useEffect(() => {
    if (permsData) {
      const map: Record<string, string[]> = {};
      for (const rp of permsData.role_permissions) {
        map[rp.role] = [...rp.permissions];
      }
      setLocalPerms(map);
    }
  }, [permsData]);

  const systemPermissions = permsData?.system_permissions ?? [];
  const manageableRoles = permsData?.manageable_roles ?? [];

  // Group permissions by category
  const byCategory = useMemo(() => {
    const map: Record<string, typeof systemPermissions> = {};
    for (const p of systemPermissions) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [systemPermissions]);

  const currentPerms = localPerms[selectedRole] ?? [];

  function togglePerm(key: string) {
    setLocalPerms((prev) => {
      const cur = prev[selectedRole] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [selectedRole]: next };
    });
  }

  function handleSave() {
    updatePerms(
      { role: selectedRole, permissions: currentPerms },
      {
        onSuccess: () => showToast(`Permissions saved for ${ROLE_LABELS[selectedRole] ?? selectedRole}.`, 'success'),
        onError: () => showToast('Failed to save permissions.', 'error'),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-md border border-gray-100 shadow-xl p-6 w-[620px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-[#E03E3E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Manage Permissions</h3>
              <p className="text-xs text-gray-400">Control what each role can access</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-100 pb-3">
          {manageableRoles.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                selectedRole === role
                  ? 'bg-[#E03E3E] text-white'
                  : 'text-gray-500 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {ROLE_LABELS[role] ?? role}
            </button>
          ))}
        </div>

        {/* Permission matrix */}
        <div className="overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-md animate-pulse" />
            ))
          ) : (
            Object.entries(byCategory).map(([category, perms]) => (
              <div key={category}>
                <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{category}</p>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map((perm) => {
                    const checked = currentPerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                          checked ? 'border-[#E03E3E]/30 bg-red-50/40' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(perm.key)}
                          className="mt-0.5 accent-[#E03E3E] flex-shrink-0"
                        />
                        <span className="text-xs text-gray-700 font-medium leading-snug">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Permissions'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const { data: staff = [], isLoading: staffLoading } = useAdminStaff();
  const { data: scheduleData, isLoading: schedLoading } = useAdminWeekSchedule();
  const { mutate: toggleStaff } = useAdminToggleStaff();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  }, []);

  const filtered = search.trim()
    ? staff.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.department.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase()) ||
        s.employee_id.toLowerCase().includes(search.toLowerCase())
      )
    : staff;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const schedule = scheduleData?.schedule ?? [];
  const summary = scheduleData?.summary;
  const teamA = schedule.slice(0, 3);
  const teamB = schedule.slice(3, 6);

  const weekLabel = scheduleData
    ? `${format(new Date(scheduleData.week_start), 'MMM d')} – ${format(new Date(scheduleData.week_end), 'MMM d, yyyy')}`
    : '';

  function handleToggle(member: StaffMember) {
    toggleStaff(member.id, {
      onSuccess: () => showToast(`${member.name} ${member.is_active ? 'deactivated' : 'activated'}.`, 'success'),
      onError: () => showToast('Failed to update status.', 'error'),
    });
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-screen-xl">
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      {showAddModal && (
        <AddStaffModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}
      {showDeptModal && (
        <ManageDepartmentsModal
          onClose={() => setShowDeptModal(false)}
          showToast={showToast}
        />
      )}
      {showPermsModal && (
        <ManagePermissionsModal
          onClose={() => setShowPermsModal(false)}
          showToast={showToast}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Orchestrate clinical excellence across departments.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowDeptModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Departments
          </button>
          <button
            onClick={() => setShowPermsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-[#E03E3E] text-[#E03E3E] text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Manage Permissions
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#E03E3E] text-white text-sm font-semibold hover:bg-[#c93535] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Staff
          </button>
        </div>
      </div>

      {/* This Week's Team Schedule */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-0.5">This Week&apos;s Team Schedule</h2>
        <p className="text-sm text-gray-400 mb-3">{weekLabel}</p>

        <div className="flex gap-4 items-stretch">
          {/* Stat Card */}
          <Card className="rounded-md border border-gray-100 shadow-sm p-5 w-64 flex-shrink-0 flex flex-col">
            {schedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 bg-gray-100 rounded-md animate-pulse" />)}
              </div>
            ) : (
              <>
                {/* Hub/network icon */}
                <div className="w-10 h-10 rounded-md bg-red-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#E03E3E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="12" cy="3" r="1.5" />
                    <circle cx="12" cy="21" r="1.5" />
                    <circle cx="3" cy="12" r="1.5" />
                    <circle cx="21" cy="12" r="1.5" />
                    <line x1="12" y1="4.5" x2="12" y2="9" />
                    <line x1="12" y1="15" x2="12" y2="19.5" />
                    <line x1="4.5" y1="12" x2="9" y2="12" />
                    <line x1="15" y1="12" x2="19.5" y2="12" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">Total Active Personnel</p>
                <p className="text-4xl font-bold text-gray-900 mt-0.5 mb-2">{summary?.total_active ?? 0}</p>

                {/* Colored text breakdown */}
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold text-[#E03E3E]">{summary?.doctors ?? 0} Doctors</span>
                  <span className="text-gray-300 mx-1">·</span>
                  <span className="font-semibold text-blue-500">{summary?.opticians ?? 0} Optometrists</span>
                  {(summary?.others ?? 0) > 0 && (
                    <>
                      <span className="text-gray-300 mx-1">·</span>
                      <span className="text-gray-500">+{summary!.others} others</span>
                    </>
                  )}
                </p>

                <ShiftProgress />

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">On-Duty Doctors</span>
                    <span className="text-xs font-bold text-[#E03E3E]">{summary?.on_duty_doctors ?? 0}/{summary?.total_doctors ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Staff Availability</span>
                    <span className="text-xs font-bold text-[#E03E3E]">{summary?.availability_pct ?? 0}%</span>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Team A + B grid */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Team A</p>
              <div className="flex gap-2">
                {schedLoading
                  ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex-1 h-24 bg-gray-100 rounded-md animate-pulse" />)
                  : teamA.map((day) => <DayCard key={day.date} day={day} />)
                }
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Team B</p>
              <div className="flex gap-2">
                {schedLoading
                  ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex-1 h-24 bg-gray-100 rounded-md animate-pulse" />)
                  : teamB.map((day) => <DayCard key={day.date} day={day} />)
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Directory */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-900">Staff Directory</h2>
            <p className="text-sm text-gray-400">Monitor all clinical staff across departments.</p>
          </div>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, role, department…"
            className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 w-64"
          />
        </div>

        <TableContainer className="rounded-md border border-gray-100 shadow-sm">
          <Table>
            <TableHead>
              <TableRow>
                <Th className="px-4 py-3 text-xs">Personnel</Th>
                <Th className="px-4 py-3 text-xs">Role & Department</Th>
                <Th className="px-4 py-3 text-xs">Status</Th>
                <Th className="px-4 py-3 text-xs">Contact Info</Th>
                <Th className="px-4 py-3 text-xs">Active</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <Td key={j} className="px-4 py-4">
                        <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                      </Td>
                    ))}
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <Td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-8 h-8 text-gray-200" />
                      <p className="text-sm text-gray-400">{search ? 'No staff match your search.' : 'No staff members yet.'}</p>
                    </div>
                  </Td>
                </TableRow>
              ) : (
                paginated.map((member, idx) => (
                  <TableRow key={member.id}>
                    <Td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} src={member.avatar} size="md" colorIndex={idx} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{member.name || member.email}</p>
                          <p className="text-xs text-gray-400">ID: {member.employee_id}</p>
                        </div>
                      </div>
                    </Td>

                    <Td className="px-4 py-3.5">
                      <p className="text-xs text-gray-400">{member.job_title}</p>
                      <p className="text-sm font-semibold text-gray-800">{member.department}</p>
                    </Td>

                    <Td className="px-4 py-3.5">
                      <StatusBadge status={member.status} />
                    </Td>

                    <Td className="px-4 py-3.5">
                      {member.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                          <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          {member.phone}
                        </div>
                      )}
                      {member.office_address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[160px]">{member.office_address}</span>
                        </div>
                      )}
                      {!member.phone && !member.office_address && (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </Td>

                    <Td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggle(member)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${member.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${member.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </Td>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!staffLoading && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              shownItems={paginated.length}
              noun="staff members"
              onPageChange={setPage}
            />
          )}
        </TableContainer>
      </div>
    </div>
  );
}
