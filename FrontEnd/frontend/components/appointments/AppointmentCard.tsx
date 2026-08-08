import React from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Appointment } from '@/services/appointments/appointments.types';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { AppointmentTypeBadge } from './AppointmentTypeBadge';

interface AppointmentCardProps {
  apt: Appointment;
  isPrimary?: boolean;
  onReschedule: (apt: Appointment) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  isCancelPending: boolean;
  isDeletePending: boolean;
}

const Timeline = ({ apt }: { apt: Appointment }) => {
  const isMissed = apt.status === 'NO_SHOW';
  const isCancelled = apt.status === 'CANCELLED';
  
  if (isMissed) return <div className="text-[10px] font-semibold text-red-500 mt-3">Booked → Confirmed → Missed</div>;
  if (isCancelled) return <div className="text-[10px] font-semibold text-gray-500 mt-3">Booked → Cancelled</div>;
  
  const steps = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];
  const currentIndex = steps.indexOf(apt.status);
  
  return (
    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[10px] font-medium mt-3">
       <span className={currentIndex >= 0 ? "text-green-600 font-bold" : "text-gray-400"}>Booked</span>
       <span className="text-gray-300">→</span>
       <span className={currentIndex >= 1 ? "text-green-600 font-bold" : "text-gray-400"}>Confirmed</span>
       {apt.is_physical && (
         <>
           <span className="text-gray-300">→</span>
           <span className={currentIndex >= 2 ? "text-green-600 font-bold" : "text-gray-400"}>Checked In</span>
         </>
       )}
       {apt.is_telehealth && (
         <>
           <span className="text-gray-300">→</span>
           <span className={currentIndex >= 3 ? "text-green-600 font-bold" : "text-gray-400"}>In Progress</span>
         </>
       )}
       <span className="text-gray-300">→</span>
       <span className={currentIndex >= 4 ? "text-green-600 font-bold" : "text-gray-400"}>Completed</span>
    </div>
  );
};

export default function AppointmentCard({
  apt,
  isPrimary = false,
  onReschedule,
  onCancel,
  onDelete,
  isCancelPending,
  isDeletePending
}: AppointmentCardProps) {
  const router = useRouter();
  const aptDate = parseISO(apt.appointment_date);
  const isMissed = apt.status === 'NO_SHOW';

  if (isPrimary) {
    return (
      <div className="card bg-white border border-gray-100 shadow-sm mb-6 rounded-md overflow-hidden">
        {/* Card Header */}
        <div className="flex flex-wrap justify-between items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-50 bg-white">
          <div className="flex items-center gap-3">
             <AppointmentTypeBadge type={apt.appointment_type} label={apt.appointment_type_display} />
             <StatusBadge status={apt.status} label={apt.status_display} />
          </div>
          <span className="text-gray-400 text-[11px]">Booked {format(parseISO(apt.created_at), 'MMM dd, yyyy')}</span>
        </div>

        {/* Card Body */}
        <div className="card-body p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Left Date Box */}
            <div className={`rounded-md p-4 flex flex-col items-center justify-center min-w-[76px] h-[76px] sm:min-w-[84px] sm:h-[84px] shrink-0 ${isMissed ? 'bg-red-50 text-red-500' : 'bg-[#FEF6F6] text-[#E03E3E]'}`}>
              <span className="text-[11px] font-bold uppercase mb-0.5">{format(aptDate, 'MMM')}</span>
              <span className="text-2xl sm:text-[28px] font-bold leading-none mb-0.5">{format(aptDate, 'dd')}</span>
              <span className="text-[11px] font-medium">{format(aptDate, 'EEE')}</span>
            </div>

            {/* Middle Details */}
            <div className="flex-1 flex flex-col justify-center">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2">
                {apt.service?.name} {apt.doctor ? `with Dr. ${apt.doctor.last_name}` : ''}
              </h3>
              <div className="flex flex-col sm:flex-row gap-y-1.5 gap-x-6">
                <div className="flex items-center text-xs text-gray-600 font-medium min-w-0">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {apt.appointment_time}
                </div>
                <div className="flex items-center text-xs text-gray-600 font-medium min-w-0">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {apt.is_telehealth ? 'Secure Video Consultation' : 'Main clinic - Suite 402, Abuja'}
                </div>
              </div>
              <Timeline apt={apt} />
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        {isMissed ? (
          <div className="border-t border-gray-50 bg-[#FEF6F6] px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#E03E3E]">You missed this appointment</div>
            <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <Button variant="default" size="md" className="font-bold px-4 w-full sm:w-auto" onClick={() => onReschedule(apt)}>
                Rebook Appointment
              </Button>
              <Button variant="secondary" size="md" className="font-bold px-4 w-full sm:w-auto bg-white shadow-sm border border-red-100">
                Contact Clinic
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-50 bg-white px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              {apt.is_telehealth && apt.can_join && (
                <Button 
                  variant="default" 
                  size="md" 
                  className="font-bold px-4 w-full sm:w-auto" 
                  onClick={() => {
                    if (apt.telehealth_session_id) {
                      router.push(`/dashboard/telehealth/${apt.telehealth_session_id}/waiting-room`);
                    } else if (apt.meeting_link) {
                      const match = apt.meeting_link.match(/\/dashboard\/telehealth\/([a-f0-9-]+)/i);
                      if (match && match[1]) {
                        router.push(`/dashboard/telehealth/${match[1]}/waiting-room`);
                      } else {
                        // Fallback: parse as relative path or absolute pathname
                        try {
                          const url = apt.meeting_link.startsWith('http') 
                            ? new URL(apt.meeting_link) 
                            : new URL(apt.meeting_link, window.location.origin);
                          router.push(url.pathname);
                        } catch (e) {
                          // absolute fallback
                          router.push(apt.meeting_link);
                        }
                      }
                    }
                  }}
                >
                  Join Consultation
                </Button>
              )}
              {apt.is_physical && apt.status === 'CONFIRMED' && (
                <Button variant="default" size="md" className="font-bold px-4 w-full sm:w-auto">
                  Check-in Online
                </Button>
              )}
              <Button 
                variant="secondary" 
                size="md"
                className="font-bold px-4 w-full sm:w-auto"
                onClick={() => onReschedule(apt)}>
                Re-schedule
              </Button>
            </div>
            {apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
              <Button 
                variant="link"
                size="md"
                onClick={() => onCancel(apt.id)}
                isLoading={isCancelPending}
                loadingText="Cancelling..."
                className="text-[#E03E3E] hover:text-[#c93636] font-bold w-full sm:w-auto text-center sm:text-right px-0">
                Cancel Appointment
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Subsequent Secondary Cards
  return (
    <div className="card bg-white border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center p-3.5 sm:p-4 gap-3 sm:gap-4 rounded-md">
      {/* Left Date Box */}
      <div className={`rounded-md p-3 flex flex-col items-center justify-center min-w-[64px] h-[68px] shrink-0 self-start sm:self-auto ${isMissed ? 'bg-red-50 text-red-500' : 'bg-[#FEF6F6] text-[#E03E3E]'}`}>
        <span className="text-[10px] font-bold uppercase mb-0.5">{format(aptDate, 'MMM')}</span>
        <span className="text-xl font-bold leading-none mb-0.5">{format(aptDate, 'dd')}</span>
        <span className="text-[10px] font-medium">{format(aptDate, 'EEE')}</span>
      </div>

      {/* Middle Details */}
      <div className="flex-1 w-full min-w-0 text-left">
        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
           <AppointmentTypeBadge type={apt.appointment_type} label={apt.appointment_type_display} />
           <StatusBadge status={apt.status} label={apt.status_display} />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1.5 truncate">{apt.service?.name}</h3>
        <div className="flex flex-wrap items-center gap-y-1 gap-x-4">
          <div className="flex items-center text-xs text-gray-500 font-medium">
            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Dr. {apt.doctor?.last_name}
          </div>
          <div className="flex items-center text-xs text-gray-500 font-medium">
            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {apt.appointment_time}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {!isMissed && apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
          <Button 
            variant="secondary"
            size="sm"
            className="font-bold h-9 px-4"
            onClick={() => onReschedule(apt)}>
            Re-schedule
          </Button>
        )}
        <Button 
          variant="outline"
          size="icon"
          onClick={() => onDelete(apt.id)}
          isLoading={isDeletePending}
          className="border-[#E03E3E] text-[#E03E3E] hover:bg-red-50 hover:text-[#E03E3E] hover:border-[#E03E3E] h-9 w-9 p-0">
          {!isDeletePending && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
        </Button>
      </div>
    </div>
  );
}
