"use client";

import React from 'react';
import { SharedMessagingContainer } from '@/components/messages';

export default function DoctorMessagesPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Clinical Inbox</h1>
        <p className="text-gray-500 text-xs mt-0.5 font-semibold">
          Manage triage conversations and communication with your assigned patients.
        </p>
      </div>
      
      <SharedMessagingContainer />
    </div>
  );
}
