'use client';

import React, { Suspense } from 'react';
import { MedicalRecordsDashboard } from '@/components/medical-records/MedicalRecordsDashboard';
import { Loader2 } from 'lucide-react';

export default function PatientRecordsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Loading your health dashboard...</p>
      </div>
    }>
      <MedicalRecordsDashboard mode="PATIENT" />
    </Suspense>
  );
}
