// components/profile/ProfileLayout.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  User as UserIcon, Phone, Mail,
  MapPin, Bell, Shield, Award, Calendar, Truck, Pencil, X, Check, Loader2, Save,
} from 'lucide-react';
import { Country, State } from 'country-state-city';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const formatDOBAndAge = (dobString: string | null) => {
  if (!dobString) return "Not Provided";
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return `${dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${age} years old)`;
};

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (form.new_password !== form.confirm_password) {
      toast.error("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/change-password/', form);
      toast.success("Password changed successfully.");
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to change password.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-white rounded-3xl">
        <h3 className="font-bold text-xl text-gray-900 mb-4">Change Password</h3>
        <div className="space-y-4">
          {(['current_password', 'new_password', 'confirm_password'] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                {field === 'current_password' ? 'Current Password' : field === 'new_password' ? 'New Password' : 'Confirm New Password'}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={form[field]}
                onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="modal-action mt-6">
          <button className="btn btn-ghost rounded-md" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn bg-[#E03E3E] text-white hover:bg-[#c93636] border-none rounded-md px-6"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop bg-black/20" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}

const SPECIALIZATIONS = [
  { value: 'OPTOMETRIST',          label: 'Optometrist' },
  { value: 'OPHTHALMOLOGIST',      label: 'Ophthalmologist' },
  { value: 'ENT',                  label: 'ENT Specialist' },
  { value: 'GENERAL_PRACTITIONER', label: 'General Practitioner' },
];

function DoctorProfileSection({ user, profileData, setProfileData, profilePicture, coverPhoto, doctorName, getInitials, isPasswordModalOpen, setIsPasswordModalOpen }: any) {
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [draft, setDraft]       = useState<any>({});

  const startEdit = () => {
    setDraft({
      first_name:          user.first_name || '',
      last_name:           user.last_name  || '',
      phone_number:        profileData?.phone_number || '',
      office_address:      profileData?.office_address || '',
      specialization:      profileData?.specialization || '',
      license_number:      profileData?.license_number || '',
      years_of_experience: profileData?.years_of_experience ?? profileData?.years_experience ?? 0,
      bio:                 profileData?.bio || '',
      max_daily_patients:  profileData?.max_daily_patients ?? 15,
      telehealth_enabled:  profileData?.telehealth_enabled ?? true,
      is_accepting_patients: profileData?.is_accepting_patients ?? true,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put('/users/profile/', draft);
      setProfileData((prev: any) => ({ ...prev, ...draft, ...(res.data?.data ?? {}) }));
      setEditing(false);
      toast.success('Profile updated successfully.');
    } catch {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: string, type: string = 'text', placeholder?: string) => (
    <div>
      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">{label}</label>
      <input
        type={type}
        value={draft[key] ?? ''}
        onChange={e => setDraft((p: any) => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2 text-xs text-gray-900"
      />
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto pt-6 pb-24 px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-500">

      {/* Hero card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-32 w-full bg-gradient-to-r from-blue-900 to-indigo-950 relative">
          {coverPhoto && <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />}
        </div>
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-end mb-5">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 -mt-12 sm:-mt-16 rounded-full border-4 border-white overflow-hidden shadow-md bg-gray-100 flex items-center justify-center shrink-0">
              {profilePicture
                ? <img src={profilePicture} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-3xl sm:text-4xl font-bold text-gray-400">{getInitials()}</span>}
            </div>
            <div className="flex-1 pb-2">
              <h1 className="text-2xl font-bold text-gray-900">{doctorName}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5 font-medium">
                <span>{profileData?.specialization || 'Specialist'}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span>{profileData?.years_of_experience ?? profileData?.years_experience ?? 0} yrs experience</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${profileData?.is_accepting_patients ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {profileData?.is_accepting_patients ? 'Accepting Patients' : 'Not Accepting'}
                </span>
              </div>
            </div>
            <button
              onClick={editing ? () => setEditing(false) : startEdit}
              className="flex items-center gap-1.5 text-xs font-bold text-[#E03E3E] hover:underline shrink-0 self-start sm:self-end"
            >
              {editing ? <><X className="w-3.5 h-3.5" />Cancel</> : <><Pencil className="w-3.5 h-3.5" />Edit Profile</>}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-gray-100 pt-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">License Number</p>
              <p className="text-base font-bold text-gray-900">{profileData?.license_number || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Employment Date</p>
              <p className="text-base font-bold text-gray-900">
                {profileData?.employment_date
                  ? new Date(profileData.employment_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : 'Not provided'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-gray-900">Edit Profile</h2>
          </div>

          {/* Personal */}
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Personal</p>
            <div className="grid grid-cols-2 gap-3">
              {field('First Name', 'first_name')}
              {field('Last Name', 'last_name')}
              {field('Phone Number', 'phone_number', 'tel', '+234...')}
              {field('Office Address', 'office_address', 'text', 'e.g. Naderk Eye Center, Abuja')}
            </div>
          </div>

          {/* Professional */}
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Professional</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Specialization</label>
                <select
                  value={draft.specialization}
                  onChange={e => setDraft((p: any) => ({ ...p, specialization: e.target.value }))}
                  className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2 text-xs text-gray-900 bg-white"
                >
                  {SPECIALIZATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {field('License Number', 'license_number')}
              {field('Years of Experience', 'years_of_experience', 'number')}
              {field('Max Daily Patients', 'max_daily_patients', 'number')}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Bio</label>
            <textarea
              rows={4}
              value={draft.bio}
              onChange={e => setDraft((p: any) => ({ ...p, bio: e.target.value }))}
              placeholder="Write a professional bio..."
              className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2 text-xs text-gray-900 resize-none"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            {[
              { key: 'telehealth_enabled', label: 'Telehealth Enabled' },
              { key: 'is_accepting_patients', label: 'Accepting Patients' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!draft[key]}
                  onChange={e => setDraft((p: any) => ({ ...p, [key]: e.target.checked }))}
                  className="w-4 h-4 accent-[#E03E3E]" />
                <span className="text-xs font-semibold text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#E03E3E] hover:bg-[#c93636] text-white text-xs font-bold px-5 py-2.5 rounded-md transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Contact Information</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 space-y-5">
            {[
              { icon: Phone, label: 'Phone Number', value: profileData?.phone_number || 'Not provided' },
              { icon: Mail,  label: 'Email Address', value: user.email },
              { icon: MapPin, label: 'Office Address', value: profileData?.office_address || 'Not provided' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-snug">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Professional */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Professional Information</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Telehealth</p>
                <p className="text-sm font-bold text-gray-900">{profileData?.telehealth_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Max Daily Patients</p>
                <p className="text-sm font-bold text-gray-900">{profileData?.max_daily_patients ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 mb-1">Bio</p>
                <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                  {profileData?.bio || 'No biography provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Security & Account</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Password</p>
                  <p className="text-gray-500 text-xs mt-0.5">Secure your doctor portal account</p>
                </div>
              </div>
              <button onClick={() => setIsPasswordModalOpen(true)} className="text-[#E03E3E] text-xs font-semibold hover:underline">
                Change Password
              </button>
            </div>
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Notifications</p>
                  <p className="text-gray-500 text-xs mt-0.5">Configure consultation alarms and alerts</p>
                </div>
              </div>
              <button className="text-[#E03E3E] text-xs font-semibold hover:underline">Manage</button>
            </div>
          </div>
        </div>
      </div>

      {isPasswordModalOpen && <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} />}
    </div>
  );
}

export default function ProfileLayout() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);

  // Inline delivery address edit (structured)
  const [editingDelivery, setEditingDelivery]     = useState(false);
  const [savingDelivery, setSavingDelivery]       = useState(false);
  const [draftStreet, setDraftStreet]             = useState('');
  const [draftCity, setDraftCity]                 = useState('');
  const [draftState, setDraftState]               = useState('');
  const [draftCountry, setDraftCountry]           = useState('');

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states    = useMemo(
    () => draftCountry ? State.getStatesOfCountry(draftCountry) : [],
    [draftCountry]
  );

  const startEditDelivery = () => {
    setDraftStreet(profileData?.delivery_street || '');
    setDraftCity(profileData?.delivery_city || '');
    setDraftState(profileData?.delivery_state || '');
    setDraftCountry(profileData?.delivery_country || '');
    setEditingDelivery(true);
  };

  const handleSaveDelivery = async () => {
    if (!draftStreet.trim() || !draftCity.trim() || !draftCountry) {
      toast.error('Street, city and country are required.');
      return;
    }
    setSavingDelivery(true);
    try {
      const payload = {
        delivery_street: draftStreet.trim(),
        delivery_city: draftCity.trim(),
        delivery_state: draftState,
        delivery_country: draftCountry,
      };
      await apiClient.put('/users/profile/', payload);
      setProfileData((prev: any) => ({ ...prev, ...payload }));
      setEditingDelivery(false);
      toast.success('Delivery address saved.');
    } catch {
      toast.error('Failed to save delivery address.');
    } finally {
      setSavingDelivery(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        if (user.role === 'PATIENT') {
          const response = await apiClient.get('/users/profile/');
          setProfileData(response.data.data);
        } else if (user.role === 'DOCTOR') {
          const response = await apiClient.get('/users/profile/');
          setProfileData(response.data.data);
        } else {
          setProfileData({
            department: "Clinical Staff",
            employee_id: "EMP-STAFF-1234",
            employment_date: "2024-01-15",
            office_address: "Naderk Eye Center HQ, Abuja",
          });
        }
      } catch {
        toast.error("Failed to load profile data.");
      } finally {
        setIsFetching(false);
      }
    };
    fetchProfile();
  }, [user]);

  if (isFetching || !user) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading profile...</div>;
  }

  const getInitials = () => {
    if (user.first_name && user.last_name) return `${user.first_name[0]}${user.last_name[0]}`;
    return user.email?.[0].toUpperCase() || "U";
  };

  const doctorName = `Dr. ${user.first_name || ''} ${user.last_name || ''}`.trim();
  const profilePicture = profileData?.profile_picture || profileData?.avatar || user.profile_picture;
  const coverPhoto = profileData?.cover_photo || user.cover_photo;

  // ── Doctor Profile ────────────────────────────────────────────────
  if (user.role === 'DOCTOR') {
    return <DoctorProfileSection
      user={user}
      profileData={profileData}
      setProfileData={setProfileData}
      profilePicture={profilePicture}
      coverPhoto={coverPhoto}
      doctorName={doctorName}
      getInitials={getInitials}
      isPasswordModalOpen={isPasswordModalOpen}
      setIsPasswordModalOpen={setIsPasswordModalOpen}
    />;
  }

  // ── Patient Profile ───────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto pt-6 pb-24 px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="h-24 sm:h-32 w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900" />

        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-end mb-5">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 -mt-12 sm:-mt-16 rounded-md border-4 border-white overflow-hidden shadow-md bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-3xl sm:text-4xl font-bold text-gray-400">{getInitials()}</span>
            </div>
            <div className="flex-1 pb-2">
              <h1 className="text-2xl font-bold text-gray-900">{user.first_name} {user.last_name}</h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 font-medium">
                <span>ID: {profileData?.patient_id || 'NE-PENDING'}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span>Patient since {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '...'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-gray-100 pt-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date of Birth</p>
              <p className="text-base font-bold text-gray-900">{formatDOBAndAge(profileData?.dob)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Gender</p>
              <p className="text-base font-bold text-gray-900">{profileData?.gender || 'Not Provided'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Contact Information</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 space-y-5">
            {[
              { icon: Phone, label: 'Phone', value: profileData?.phone_number || 'Not Provided' },
              { icon: Mail, label: 'Email', value: user.email },
              { icon: MapPin, label: 'Primary Address', value: profileData?.address ? `${profileData.address}, ${profileData.city}, ${profileData.state}` : 'Not Provided' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-snug">{value}</p>
                </div>
              </div>
            ))}

            {/* Delivery Address — structured inline edit */}
            <div className="flex items-start gap-3 border-t border-gray-50 pt-4">
              <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0 mt-0.5">
                <Truck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-gray-900 text-sm">Delivery Address</p>
                  {!editingDelivery && (
                    <button
                      onClick={startEditDelivery}
                      className="text-[10px] font-bold text-[#E03E3E] flex items-center gap-1 hover:underline shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      {profileData?.delivery_street ? 'Edit' : 'Add'}
                    </button>
                  )}
                </div>

                {editingDelivery ? (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={draftStreet}
                      onChange={e => setDraftStreet(e.target.value)}
                      placeholder="Street address *"
                      className="w-full border border-gray-200 focus:border-[#E03E3E] focus:outline-none rounded-md px-3 py-2 text-xs text-gray-900"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={draftCountry}
                        onChange={e => { setDraftCountry(e.target.value); setDraftState(''); }}
                        className="border border-gray-200 focus:border-[#E03E3E] focus:outline-none rounded-md px-3 py-2 text-xs text-gray-900 bg-white"
                      >
                        <option value="">Country *</option>
                        {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                      </select>
                      <select
                        value={draftState}
                        onChange={e => setDraftState(e.target.value)}
                        disabled={!draftCountry || states.length === 0}
                        className="border border-gray-200 focus:border-[#E03E3E] focus:outline-none rounded-md px-3 py-2 text-xs text-gray-900 bg-white disabled:opacity-50"
                      >
                        <option value="">State / Province</option>
                        {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={draftCity}
                      onChange={e => setDraftCity(e.target.value)}
                      placeholder="City *"
                      className="w-full border border-gray-200 focus:border-[#E03E3E] focus:outline-none rounded-md px-3 py-2 text-xs text-gray-900"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDelivery}
                        disabled={savingDelivery}
                        className="flex items-center gap-1 bg-[#E03E3E] text-white text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-[#c93636] transition"
                      >
                        {savingDelivery ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDelivery(false)}
                        className="flex items-center gap-1 border border-gray-200 text-gray-500 text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-gray-50 transition"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs mt-0.5 leading-snug">
                    {profileData?.delivery_street ? (
                      [profileData.delivery_street, profileData.delivery_city,
                       profileData.delivery_state && State.getStateByCodeAndCountry?.(profileData.delivery_state, profileData.delivery_country)?.name,
                       profileData.delivery_country && Country.getCountryByCode?.(profileData.delivery_country)?.name]
                        .filter(Boolean).join(', ')
                    ) : (
                      <span className="text-yellow-600 font-semibold">Not set — required for marketplace orders</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Insurance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Insurance Details</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-5">
              {[
                { label: 'Provider Name', value: profileData?.insurance_provider || 'Not provided' },
                { label: 'Policy Number', value: profileData?.policy_number || 'Not provided' },
                { label: 'Hospital Number', value: profileData?.patient_id || 'Not Assigned' },
                { label: 'Primary Cardholder', value: `${user.first_name} ${user.last_name}`.trim() },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setIsInsuranceModalOpen(true)} className="text-[#E03E3E] text-xs font-semibold hover:underline mx-auto block">
              Update Insurance
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Security & Account Settings</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Password</p>
                  <p className="text-gray-500 text-xs mt-0.5">Secure your account with a strong password</p>
                </div>
              </div>
              <button onClick={() => setIsPasswordModalOpen(true)} className="text-[#E03E3E] text-xs font-semibold hover:underline whitespace-nowrap">
                Change Password
              </button>
            </div>
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#fee2e2] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Notification</p>
                  <p className="text-gray-500 text-xs mt-0.5">Email, SMS, and portal alerts</p>
                </div>
              </div>
              <button className="text-[#E03E3E] text-xs font-semibold hover:underline">Manage</button>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">Emergency Contact</h2>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="bg-gray-50 rounded-md p-5 flex-1 space-y-3">
              {profileData?.emergency_contact_name ? (
                <>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{profileData.emergency_contact_name}</h3>
                    <p className="text-gray-500 text-xs">{profileData.emergency_contact_relationship}</p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-[#E03E3E]" />
                      <span>{profileData.emergency_contact_phone}</span>
                    </div>
                    {profileData.emergency_contact_email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-[#E03E3E]" />
                        <span>{profileData.emergency_contact_email}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 text-xs py-4">No emergency contact provided</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isPasswordModalOpen && <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} />}

      {/* Insurance Modal */}
      {isInsuranceModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box bg-white rounded-3xl max-w-md">
            <h3 className="font-bold text-xl text-gray-900 mb-4">Add Secondary Insurance</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Provider Name</label>
                <Input placeholder="e.g. XYZ Health" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Policy Number</label>
                <Input placeholder="e.g. XYZ-987654321" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Group Number (Optional)</label>
                <Input placeholder="e.g. GRP-123" />
              </div>
            </div>
            <div className="modal-action mt-6">
              <button className="btn btn-ghost rounded-md" onClick={() => setIsInsuranceModalOpen(false)}>Cancel</button>
              <button className="btn bg-[#E03E3E] text-white hover:bg-[#c93636] border-none rounded-md px-6" onClick={() => setIsInsuranceModalOpen(false)}>
                Add Insurance
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop bg-black/20" onClick={() => setIsInsuranceModalOpen(false)}>
            <button>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
