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
    const JOIN_WINDOW_MINUTES = 30;
    const isJoinableStatus = ['READY', 'WAITING', 'IN_PROGRESS', 'SCHEDULED'].includes(session.status);
    let withinJoinWindow = true;
    try {
      const startMs = parseISO(session.scheduled_start).getTime();
      withinJoinWindow = Date.now() >= startMs - JOIN_WINDOW_MINUTES * 60_000;
    } catch {
      withinJoinWindow = true;
    }
    // Doctors may open the room early to prepare; patients wait for the window.
    const canJoin = isJoinableStatus && (isDoctor || withinJoinWindow);
    const joinBlockedEarly = isJoinableStatus && !isDoctor && !withinJoinWindow;

    return (
      <div
        key={session.id}
        className="bg-white border border-gray-100 rounded-md p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        {/* min-w-0 lets the text block shrink instead of forcing the row wider
            than its container when a service or doctor name is long. */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-[#E03E3E]/5 flex items-center justify-center text-[#E03E3E] shrink-0">
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-gray-900 leading-snug truncate">
                {session.service_name}
              </h3>
              <TelehealthStatusBadge status={session.status} />
            </div>

            <p className="text-xs text-gray-600 font-medium flex items-center gap-1.5 mb-0.5 min-w-0">
              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-400 font-normal shrink-0">{counterPartyLabel}:</span>
              <span className="truncate">{counterParty.display_name}</span>
            </p>

            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{formatSessionTime(session.scheduled_start)}</span>
            </p>
          </div>
        </div>

        {/* Full-width buttons on phones, inline from sm up — three actions at a
            fixed width used to overflow the card on narrow screens. */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2 lg:shrink-0">
          {canJoin && (
            <Link
              href={`${basePath}/${session.id}`}
              className="inline-flex items-center justify-center h-9 px-4 bg-[#E03E3E] hover:bg-[#c93232] text-white text-xs font-semibold rounded-md transition-colors"
            >
              Join Session
            </Link>
          )}

          {joinBlockedEarly && (
            <span
              title={`Available ${JOIN_WINDOW_MINUTES} minutes before the scheduled time`}
              className="inline-flex items-center justify-center h-9 px-4 bg-gray-100 text-gray-400 text-xs font-semibold rounded-md cursor-not-allowed"
            >
              Join Session
            </span>
          )}

          <Link
            href={`${basePath}/${session.id}`}
            className="inline-flex items-center justify-center h-9 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-colors"
          >
            View Details
          </Link>

          {session.status === 'COMPLETED' && session.conversation_id && (
            <Link
              href={`${messagesPath}?conversation_id=${session.conversation_id}`}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Message
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
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* Active Sessions */}
      {sessions.active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-[#E03E3E] uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E03E3E] animate-ping"></span>
            Active Session
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {sessions.active.map(s => renderSessionCard(s, true))}
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Upcoming Consultations
        </h2>
        {sessions.upcoming.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {sessions.upcoming.map(s => renderSessionCard(s, false))}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-md p-5 text-center text-gray-400 text-xs sm:text-sm">
            No upcoming virtual consultations scheduled.
          </div>
        )}
      </div>

      {/* Completed/Past Sessions */}
      {sessions.past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Completed Consultations
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {sessions.past.map(s => renderSessionCard(s, false))}
          </div>
        </div>
      )}
    </div>
  );
}
