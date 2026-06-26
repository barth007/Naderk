"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTelehealthSessionDetail } from '@/services/telehealth/telehealth.hooks';
import { Loader2, CheckCircle2, MessageSquare, Calendar, User, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

export default function TelehealthSessionCompletedPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const { data: session, isLoading, error } = useTelehealthSessionDetail(sessionId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm">Retrieving consultation summary...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-20 max-w-md mx-auto min-h-screen flex flex-col justify-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Session not found</h3>
        <p className="text-gray-500 text-sm mb-6">
          The requested telehealth session detail is unavailable.
        </p>
        <Link href="/dashboard/telehealth" className="px-4 py-2 bg-[#E03E3E] text-white text-xs font-semibold rounded-md transition-all">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const doctorName = session.doctor.display_name;
  const formattedDate = () => {
    try {
      return format(parseISO(session.scheduled_start), 'MMMM do, yyyy');
    } catch {
      return session.scheduled_start;
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 min-h-[80vh] flex flex-col justify-center">
      <div className="bg-white border border-gray-100 rounded-md p-8 shadow-sm text-center">
        {/* Success Check Icon */}
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-500 mx-auto mb-6 border border-green-100">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        {/* Headline */}
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">
          Consultation Completed
        </h1>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-8 leading-relaxed">
          Your telehealth video consultation has ended. A summary of the session is provided below.
        </p>

        {/* Summary Card */}
        <div className="bg-gray-50 border border-gray-100 rounded-md p-5 text-left mb-8 space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-200 pb-2 mb-2">
            Consultation Details
          </h3>
          
          {/* Doctor Info */}
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Medical Provider</p>
              <p className="text-xs font-bold text-gray-900">{doctorName}</p>
            </div>
          </div>

          {/* Date Info */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Date Scheduled</p>
              <p className="text-xs font-bold text-gray-900">{formattedDate()}</p>
            </div>
          </div>

          {/* Duration Info */}
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Duration</p>
              <p className="text-xs font-bold text-gray-900">
                {session.duration_minutes || 0} {session.duration_minutes === 1 ? 'minute' : 'minutes'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Link
            href="/dashboard/telehealth"
            className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-all text-center"
          >
            Back to Dashboard
          </Link>

          {session.conversation_id && (
            <Link
              href={`/dashboard/messages?conversation_id=${session.conversation_id}`}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#E03E3E] hover:bg-[#c93232] text-white text-xs font-semibold rounded-md transition-all text-center flex items-center justify-center gap-1.5 shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Send Message
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
