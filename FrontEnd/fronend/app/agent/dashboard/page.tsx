// app/agent/dashboard/page.tsx
"use client";

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';

export default function AgentDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <Card className="p-8 border border-gray-100 bg-white">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-2">
          Welcome, {user?.first_name || "Agent"}
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed max-w-2xl font-semibold">
          Manage patient chats, coordinate incoming appointment requests, and view telehealth queue metrics.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4">Patient Messaging Queue</h2>
          <EmptyState role="MEDICAL_AGENT" configKey="NO_CHATS" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4">Appointment Coordination</h2>
          <EmptyState role="DOCTOR" configKey="NO_REQUESTS" />
        </div>
      </div>
    </div>
  );
}
