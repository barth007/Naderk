"use client";

import React from 'react';
import { SharedMessagingContainer } from '@/components/messages';

export default function AgentChatsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Triage Workspace</h1>
        <p className="text-gray-500 text-xs mt-0.5 font-semibold">
          Review new patient requests, assign care providers, and manage triage messaging threads.
        </p>
      </div>
      
      <SharedMessagingContainer />
    </div>
  );
}
