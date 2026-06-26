"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { SharedTelehealthDetailContainer } from '@/components/telehealth/SharedTelehealthDetailContainer';

export default function TelehealthSessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  return <SharedTelehealthDetailContainer sessionId={sessionId} />;
}
