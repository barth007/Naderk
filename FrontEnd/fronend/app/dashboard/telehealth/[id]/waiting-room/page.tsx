"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { SharedTelehealthWaitingRoomContainer } from '@/components/telehealth/SharedTelehealthWaitingRoomContainer';

export default function TelehealthWaitingRoomPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  return <SharedTelehealthWaitingRoomContainer sessionId={sessionId} />;
}
