"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { SharedTelehealthRoomContainer } from '@/components/telehealth/SharedTelehealthRoomContainer';

export default function AgentTelehealthSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  return <SharedTelehealthRoomContainer sessionId={sessionId} />;
}
