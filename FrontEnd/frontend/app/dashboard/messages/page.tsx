"use client";

import React from 'react';
import { SharedMessagingContainer } from '@/components/messages';

/**
 * This page used to carry its own copy of the whole messaging layout, which
 * meant fixes made to SharedMessagingContainer (used by doctor/agent/admin)
 * never reached patients. It now renders the same container as every other
 * role, so there is a single messaging implementation to maintain.
 */
export default function MessagesPage() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Hidden on mobile: the chat takes the full screen there, WhatsApp-style,
          and its own header names the person you're talking to. */}
      <div className="hidden md:block mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Messages</h1>
        <p className="text-gray-500 text-xs mt-0.5 font-semibold">
          Chat securely with your care team about appointments, prescriptions, and billing.
        </p>
      </div>

      <SharedMessagingContainer />
    </div>
  );
}
