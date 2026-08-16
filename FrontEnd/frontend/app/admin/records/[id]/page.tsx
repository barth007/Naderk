'use client';

import React, { use, Suspense } from 'react';
import { MedicalRecordsDashboard } from '@/components/medical-records/MedicalRecordsDashboard';
import { Loader2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

function AdminRecordsContent({ params }: PageProps) {
  const resolvedParams = use(params);
  // Staff view of a specific patient's full records. The backend allows
  // ADMIN/SUPER_ADMIN to read any patient's records (see medical_records
  // permissions), so the DOCTOR-mode layout ("Patient: …") applies here too.
  return <MedicalRecordsDashboard mode="DOCTOR" patientId={resolvedParams.id} />;
}

export default function AdminPatientRecordsPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Loading patient records...</p>
      </div>
    }>
      <AdminRecordsContent params={params} />
    </Suspense>
  );
}
