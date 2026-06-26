"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { SharedTelehealthWaitingRoomContainer } from '@/components/telehealth/SharedTelehealthWaitingRoomContainer';

export default function AgentTelehealthWaitingRoomPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  return <SharedTelehealthWaitingRoomContainer sessionId={sessionId} />;
}
