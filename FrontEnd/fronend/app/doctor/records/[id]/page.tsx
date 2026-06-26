'use client';

import React, { use, Suspense } from 'react';
import { MedicalRecordsDashboard } from '@/components/medical-records/MedicalRecordsDashboard';
import { Loader2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

function DoctorRecordsContent({ params }: PageProps) {
  const resolvedParams = use(params);
  return <MedicalRecordsDashboard mode="DOCTOR" patientId={resolvedParams.id} />;
}

export default function DoctorPatientRecordsPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Loading patient records...</p>
      </div>
    }>
      <DoctorRecordsContent params={params} />
    </Suspense>
  );
}
