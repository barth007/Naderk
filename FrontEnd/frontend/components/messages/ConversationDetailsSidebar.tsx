import React from 'react';
import { 
  Calendar, AlertCircle, ExternalLink, User, HeartPulse, 
  FileText, Pill, Video, CalendarPlus, ShieldAlert 
} from 'lucide-react';
import { Conversation } from '@/services/messaging/messaging.types';
import { useAppointmentHistory } from '@/services/appointments/appointments.hooks';
import { usePrescriptions } from '@/services/marketplace/marketplace.hooks';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ConversationDetailsSidebarProps {
  conversation: Conversation;
}

export function ConversationDetailsSidebar({ conversation }: ConversationDetailsSidebarProps) {
  const { user: currentUser } = useAuth();
  
  // Fetch actual appointment history for the patient
  const { data: apptHistory } = useAppointmentHistory(conversation.patient.id);
  const nextAppt = apptHistory?.upcoming?.[0];
  const lastAppt = apptHistory?.past?.[0];

  // Fetch prescriptions count
  const { data: prescriptions = [] } = usePrescriptions(conversation.patient.id);
  const activePrescriptionsCount = prescriptions.filter(p => p.status === 'APPROVED').length;

  const isStaff = !!currentUser?.role && ['AGENT', 'DOCTOR', 'ADMIN', 'MEDICAL_AGENT'].includes(currentUser.role);

  const getAge = (dobString?: string) => {
    if (!dobString) return 'N/A';
    try {
      const birthDate = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return `${age} yrs`;
    } catch {
      return 'N/A';
    }
  };

  const getAppointmentTitle = (appt: any) => {
    if (appt) {
      return appt.appointment_type_display || appt.appointment_type.replace(/_/g, ' ');
    }
    return '';
  };

  const getAppointmentDateText = (appt: any) => {
    if (appt) {
      try {
        const dateObj = parseISO(appt.appointment_date);
        const formattedDate = format(dateObj, 'MMM do, yyyy');
        let timeStr = appt.appointment_time;
        if (timeStr && timeStr.length > 5) {
          timeStr = timeStr.slice(0, 5); // Format to hh:mm
        }
        return `${formattedDate} at ${timeStr}`;
      } catch (e) {
        return `${appt.appointment_date} at ${appt.appointment_time}`;
      }
    }
    return 'None';
  };

  const profileName = `${conversation.patient.first_name} ${conversation.patient.last_name}`;
  const hospitalId = conversation.patient.patient_id 
    ? conversation.patient.patient_id
    : `NE-${conversation.patient.id.slice(0, 4).toUpperCase()}`;
  const avatarInitials = `${conversation.patient.first_name?.[0] || ''}${conversation.patient.last_name?.[0] || ''}`;

  return (
    <div className="w-full h-full bg-white p-5 flex flex-col gap-5 overflow-y-auto border-l border-gray-150/70 select-none">
      
      {/* Patient Profile Header */}
      <div className="flex flex-col items-center text-center pb-5 border-b border-gray-100">
        <div className="w-20 h-20 rounded-full bg-[#faeaea] text-[#E03E3E] font-bold text-xl flex items-center justify-center border-2 border-white shadow-md relative mb-3">
          <span className="uppercase">{avatarInitials}</span>
          <div className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 rounded-full bg-green-500 border-3 border-white" />
        </div>
        
        <h3 className="font-bold text-gray-900 text-base leading-tight">
          {profileName}
        </h3>
        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
          Hospital ID: {hospitalId}
        </p>

        {/* Age & Gender pill container */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px] font-bold bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <User className="w-3 h-3 text-gray-400" />
            {getAge(conversation.patient.dob)}
          </span>
          <span className="text-[11px] font-bold bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <HeartPulse className="w-3 h-3 text-[#E03E3E]" />
            {conversation.patient.gender || 'Not specified'}
          </span>
        </div>
      </div>

      {/* Clinical Info Sidebar Section */}
      <div className="flex flex-col gap-4 text-xs">
        
        {/* Current Assigned Doctor */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned Provider</span>
          <p className="font-bold text-gray-800 flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {conversation.assigned_doctor 
              ? `Dr. ${conversation.assigned_doctor.first_name} ${conversation.assigned_doctor.last_name}`
              : 'Waiting for assignment'}
          </p>
        </div>

        {/* Active Prescriptions Count */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Prescriptions</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Pill className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-gray-800">{activePrescriptionsCount} active prescription(s)</span>
          </div>
        </div>

        {/* Appointment Timeline Widget */}
        <div className="space-y-3 pt-2">
          
          {/* Last Appointment */}
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Last Appointment</span>
            {lastAppt ? (
              <div>
                <p className="font-bold text-gray-800 text-xs truncate">{getAppointmentTitle(lastAppt)}</p>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  {getAppointmentDateText(lastAppt)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 font-semibold italic">No record of past visits</p>
            )}
          </div>

          {/* Next Appointment */}
          <div className="p-3 bg-red-50/10 border border-red-100/40 rounded-xl">
            <span className="text-[9px] font-bold text-[#E03E3E] uppercase tracking-wider block mb-1">Next Scheduled Appointment</span>
            {nextAppt ? (
              <div>
                <p className="font-bold text-gray-800 text-xs truncate">{getAppointmentTitle(nextAppt)}</p>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#E03E3E]" />
                  {getAppointmentDateText(nextAppt)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 font-semibold italic">No upcoming appointments</p>
            )}
          </div>

        </div>

        {/* Quick Actions Panel */}
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Quick Actions</span>
          
          <Button 
            id="qa_view_records"
            variant="outline"
            className="w-full justify-start text-left text-xs h-9 rounded-lg font-bold border-gray-150 hover:bg-gray-50/75 flex gap-2 cursor-pointer shadow-none"
            onClick={() => toast.success("Opening patient records dashboard...")}
          >
            <FileText className="w-4 h-4 text-gray-400" /> View Medical Records
          </Button>

          <Button 
            id="qa_view_prescriptions"
            variant="outline"
            className="w-full justify-start text-left text-xs h-9 rounded-lg font-bold border-gray-150 hover:bg-gray-50/75 flex gap-2 cursor-pointer shadow-none"
            onClick={() => toast.success("Opening prescription management dashboard...")}
          >
            <Pill className="w-4 h-4 text-gray-400" /> View Prescriptions
          </Button>

          <Button 
            id="qa_start_telehealth"
            variant="outline"
            className="w-full justify-start text-left text-xs h-9 rounded-lg font-bold border-gray-150 hover:bg-gray-50/75 flex gap-2 cursor-pointer shadow-none"
            onClick={() => toast.success("Preparing telehealth consulting session...")}
          >
            <Video className="w-4 h-4 text-indigo-500" /> Start Telehealth Session
          </Button>

          <Button 
            id="qa_schedule_followup"
            variant="outline"
            className="w-full justify-start text-left text-xs h-9 rounded-lg font-bold border-gray-150 hover:bg-gray-50/75 flex gap-2 cursor-pointer shadow-none"
            onClick={() => toast.success("Redirecting to Scheduler module...")}
          >
            <CalendarPlus className="w-4 h-4 text-[#E03E3E]" /> Schedule Follow-up
          </Button>
        </div>

      </div>

      {/* Security Info Panel */}
      <div className="bg-amber-50/20 border border-amber-100/30 rounded-xl p-3.5 flex flex-col gap-1.5 mt-auto">
        <div className="flex items-center gap-1.5 text-[9px] text-amber-700 font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Clinical Compliance</span>
        </div>
        <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">
          Secure end-to-end encryption active. All records sync automatically in accordance with healthcare standard safety logs.
        </p>
      </div>

    </div>
  );
}

export default ConversationDetailsSidebar;
