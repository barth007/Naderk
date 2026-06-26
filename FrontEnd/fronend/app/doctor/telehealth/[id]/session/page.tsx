"use client";

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { SharedTelehealthRoomContainer } from '@/components/telehealth/SharedTelehealthRoomContainer';
import { Loader2 } from 'lucide-react';

function DoctorTelehealthSessionInner() {
  const params = useParams();
  const sessionId = params.id as string;
  return <SharedTelehealthRoomContainer sessionId={sessionId} />;
}

export default function DoctorTelehealthSessionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#E03E3E]" /></div>}>
      <DoctorTelehealthSessionInner />
    </Suspense>
  );
}
