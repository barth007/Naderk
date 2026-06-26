"use client";

import React from 'react';
import { useTelehealthSessions } from '@/services/telehealth/telehealth.hooks';
import EmptyTelehealthState from '@/components/telehealth/EmptyTelehealthState';
import TelehealthDashboard from '@/components/telehealth/TelehealthDashboard';
import { Loader2, Video } from 'lucide-react';

export default function DoctorTelehealthPage() {
  const { data, isLoading, error, refetch } = useTelehealthSessions();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm">Loading virtual consultations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4">
          <Video className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Failed to load consultations</h3>
        <p className="text-gray-500 text-sm mb-6">
          There was an error retrieving your telehealth sessions. Please try again.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-[#E03E3E] hover:bg-[#c93232] text-white text-xs font-semibold rounded-md transition-all animate-pulse"
        >
          Try Again
        </button>
      </div>
    );
  }

  const hasSessions = 
    data && (data.active.length > 0 || data.upcoming.length > 0 || data.past.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Telehealth Consultations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access secure video appointments and manage patient virtual consultations.
          </p>
        </div>
      </div>

      {hasSessions ? (
        <TelehealthDashboard sessions={data} />
      ) : (
        <EmptyTelehealthState />
      )}
    </div>
  );
}
