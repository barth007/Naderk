import React, { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/useBookingStore';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';

export default function Step4PatientInfo() {
  const { notes, setAppointmentDetails, time, appointmentType } = useBookingStore();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (time && user) {
      apiClient.get('/users/profile/')
        .then(res => setProfile(res.data.data))
        .catch(err => console.error("Failed to load profile", err));
    }
  }, [time, user]);

  if (!time) return null; // Only show if time is selected

  const fullName = user?.first_name ? `${user.first_name} ${user.last_name}`.trim() : '';

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-gray-700">4. Patient's Information</h2>

      <div className="bg-white border border-gray-100 rounded-[14px] shadow-sm p-4 sm:p-8 space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
            <input type="text" readOnly defaultValue={fullName} className="w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <input type="email" readOnly defaultValue={user?.email || ''} className="w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Phone number</label>
            <input type="tel" readOnly defaultValue={profile?.phone_number || ''} className="w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Insurance Provider</label>
            <select disabled value={profile?.insurance_provider || 'Select Provider'} className="w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-gray-400 appearance-none bg-gray-50">
              <option value="Select Provider">Select Provider</option>
              {profile?.insurance_provider && profile.insurance_provider !== 'Select Provider' && (
                <option value={profile.insurance_provider}>{profile.insurance_provider}</option>
              )}
              <option value="NHIS">NHIS</option>
              <option value="Hygeia HMO">Hygeia HMO</option>
              <option value="Reliance HMO">Reliance HMO</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Insurance ID</label>
          <input type="text" readOnly defaultValue={profile?.policy_number || ''} className="w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Medical Notes(Optional)</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setAppointmentDetails(appointmentType, e.target.value)}
            placeholder="Briefly describe any specific concerns or symptoms..."
            className="w-full px-4 py-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none"
          ></textarea>
        </div>

      </div>
    </div>
  );
}
