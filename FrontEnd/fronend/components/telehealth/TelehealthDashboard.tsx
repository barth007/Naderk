import React from 'react';
import Link from 'next/link';
import { Calendar, User, Video, CheckCircle, MessageSquare } from 'lucide-react';
import { SessionsListResponse, TelehealthSession } from '@/services/telehealth/telehealth.types';
import TelehealthStatusBadge from './TelehealthStatusBadge';
import { format, parseISO, isToday } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface TelehealthDashboardProps {
  sessions: SessionsListResponse;
}

export default function TelehealthDashboard({ sessions }: TelehealthDashboardProps) {
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';

  const isAgent = user?.role === 'MEDICAL_AGENT' || user?.role === 'AGENT';
  const basePath = isDoctor
    ? '/doctor/telehealth'
    : isAgent
      ? '/agent/telehealth'
      : '/dashboard/telehealth';
  const messagesPath = isDoctor
    ? '/doctor/messages'
    : isAgent
      ? '/agent/chats'
      : '/dashboard/messages';

  const formatSessionTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      const prefix = isToday(date) ? 'Today' : format(date, 'MMM do, yyyy');
      const timeStr = format(date, 'h:mm a');
      return `${prefix} • ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  const renderSessionCard = (session: TelehealthSession, isActive: boolean = false) => {
    const counterParty = isDoctor ? session.patient : session.doctor;
    const counterPartyLabel = isDoctor ? 'Patient' : 'Specialist';
    
    // Check if joinable: sessions that are scheduled/ready/waiting/in-progress
    const canJoin = ['READY', 'WAITING', 'IN_PROGRESS', 'SCHEDULED'].includes(session.status);

    return (
      <div 
        key={session.id} 
        className="bg-white border border-gray-100 rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#E03E3E]/5 flex items-center justify-center text-[#E03E3E] shrink-0">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h3 className="text-base font-bold text-gray-900 leading-tight">
                {session.service_name}
              </h3>
              <TelehealthStatusBadge status={session.status} />
            </div>
            
            <p className="text-sm text-gray-600 font-medium flex items-center gap-1.5 mb-1">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 font-normal">{counterPartyLabel}:</span>
              {counterParty.display_name}
            </p>
            
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              {formatSessionTime(session.scheduled_start)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center">
          {/* Detail action */}
          <Link
            href={`${basePath}/${session.id}`}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-all"
          >
            View Details
          </Link>

          {/* Join action */}
          {canJoin && (
            <Link
              href={`${basePath}/${session.id}`}
              className="px-4 py-2 bg-[#E03E3E] hover:bg-[#c93232] text-white text-xs font-semibold rounded-md transition-all shadow-sm"
            >
              Join Session
            </Link>
          )}

          {/* Chat Action from completed session */}
          {session.status === 'COMPLETED' && session.conversation_id && (
            <Link
              href={`${messagesPath}?conversation_id=${session.conversation_id}`}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send Message
            </Link>
          )}
        </div>
      </div>
    );
  };

  const totalSessions = 
    sessions.active.length + 
    sessions.upcoming.length + 
    sessions.past.length;

  if (totalSessions === 0) {
    return null; // EmptyState will handle it
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Active Sessions */}
      {sessions.active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-[#E03E3E] uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E03E3E] animate-ping"></span>
            Active Session
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {sessions.active.map(s => renderSessionCard(s, true))}
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Upcoming Consultations
        </h2>
        {sessions.upcoming.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {sessions.upcoming.map(s => renderSessionCard(s, false))}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-md p-6 text-center text-gray-400 text-sm">
            No upcoming virtual consultations scheduled.
          </div>
        )}
      </div>

      {/* Completed/Past Sessions */}
      {sessions.past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Completed Consultations
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {sessions.past.map(s => renderSessionCard(s, false))}
          </div>
        </div>
      )}
    </div>
  );
}
