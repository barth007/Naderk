"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calendar, Clock, MessageSquare, Video, Clipboard, FileText, Loader2, AlertTriangle, 
  Download, Link2, CalendarDays
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BlogWidget } from '@/components/dashboard/BlogWidget';
import { Avatar } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { 
  useAppointmentHistory, 
  useCancelAppointment 
} from '@/services/appointments/appointments.hooks';
import { usePrescriptions } from '@/services/marketplace/marketplace.hooks';
import { useConversations } from '@/services/messaging/messaging.hooks';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Queries
  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointmentHistory();
  const { data: prescriptions = [], isLoading: prescriptionsLoading } = usePrescriptions();
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  
  // Mutation
  const cancelMutation = useCancelAppointment();

  const handleCancel = async (id: string) => {
    if (confirm("Are you sure you want to cancel this appointment?")) {
      try {
        await cancelMutation.mutateAsync(id);
        toast.success("Appointment cancelled successfully.");
      } catch (error) {
        toast.error("Failed to cancel appointment.");
      }
    }
  };

  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const computeGreeting = () => {
      const hr = new Date().getHours();
      if (hr < 12) return 'Good morning';
      if (hr < 17) return 'Good afternoon';
      return 'Good evening';
    };
    setGreeting(computeGreeting());
    // Update if the user leaves the tab open across a time boundary
    const interval = setInterval(() => setGreeting(computeGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timeStr: string) => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const dt = new Date(`${todayStr}T${timeStr}`);
      if (!isNaN(dt.getTime())) {
        return format(dt, 'h:mm a');
      }
    } catch { }
    return timeStr;
  };

  const getFormattedMessageTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const isToday = new Date().toDateString() === date.toDateString();
      return format(date, isToday ? 'h:mm a' : 'MMM d');
    } catch {
      return '';
    }
  };

  // Resolved dynamic values
  const upcomingAppointments = appointmentsData?.upcoming || [];
  const upcomingAppt = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

  const pastAppointments = appointmentsData?.past || [];
  const lastCheckupDate = pastAppointments.length > 0
    ? format(parseISO(pastAppointments[0].appointment_date), 'MMM dd, yyyy')
    : 'None yet';

  const activePrescriptions = prescriptions?.filter(p => p.status === 'APPROVED') || [];
  const nextPrescriptionText = activePrescriptions.length > 0 && activePrescriptions[0].expires_at
    ? `Expires ${format(parseISO(activePrescriptions[0].expires_at), 'MMM dd, yyyy')}`
    : 'None';

  const getWelcomeMessage = (appt: any) => {
    if (!appt) {
      return "Your vision is our priority. Let's get your vision journey started by booking a new appointment.";
    }
    try {
      const apptDate = parseISO(appt.appointment_date);
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      let dateStr = "";
      if (apptDate.toDateString() === today.toDateString()) {
        dateStr = "today";
      } else if (apptDate.toDateString() === tomorrow.toDateString()) {
        dateStr = "tomorrow";
      } else {
        dateStr = `on ${format(apptDate, 'MMMM dd, yyyy')}`;
      }

      const timeStr = formatTime(appt.appointment_time);
      return `Your vision is our priority. You have an upcoming appointment ${dateStr} at ${timeStr}.`;
    } catch {
      return "Your vision is our priority. You have an upcoming appointment scheduled.";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 select-none">
      
      {/* Welcome & Overview Header Card */}
      <Card className="p-6 md:p-8 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4 flex-grow min-w-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              {greeting}, {user?.first_name || 'Sarah'}!
            </h1>
            <p className="text-gray-500 text-sm mt-1.5 font-semibold">
              {getWelcomeMessage(upcomingAppt)}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="bg-gray-50/50 border border-gray-100 p-3.5 rounded-md w-40 min-w-fit flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Last Checkup</span>
              <span className="text-xs font-bold text-gray-800 mt-1">{lastCheckupDate}</span>
            </div>
            <div className="bg-gray-50/50 border border-gray-100 p-3.5 rounded-md w-40 min-w-fit flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Next Prescription</span>
              <span className="text-xs font-bold text-gray-800 mt-1">{nextPrescriptionText}</span>
            </div>
          </div>
        </div>

        {/* Target Red Box */}
        <div className="w-20 h-20 md:w-24 md:h-24 bg-[#E03E3E] rounded-2xl flex items-center justify-center shrink-0 shadow-[0_8px_30px_rgba(224,62,62,0.15)]">
          <div className="w-10 h-10 rounded-full border-4 border-white flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
          </div>
        </div>
      </Card>

      {/* Row 2: Upcoming Appointment (Left) & Messages (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Upcoming Appointment */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="mb-4 flex items-center gap-2 shrink-0">
            <Calendar className="w-5 h-5 text-gray-650" />
            <h3 className="font-extrabold text-gray-955 text-base">Upcoming Appointment</h3>
          </div>

          {appointmentsLoading ? (
            <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] h-[213px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" />
            </Card>
          ) : upcomingAppt ? (
            <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] h-[213px]">
              <div className="flex flex-col md:flex-row gap-6 items-center h-full">
                <div className="w-full md:w-1/3 rounded-md overflow-hidden relative min-h-[140px] md:min-h-0 md:h-full shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=400"
                    alt="Clinic lobby"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <div className="flex-grow flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-[#E03E3E] tracking-wider uppercase">
                      {upcomingAppt.service?.name || 'Comprehensive Eye Exam'}
                    </span>
                    <h4 className="text-base font-extrabold text-gray-955 leading-tight">
                      Dr. {upcomingAppt.doctor?.first_name} {upcomingAppt.doctor?.last_name}, OD
                    </h4>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">NaderkEye Centre main branch.</p>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleCancel(upcomingAppt.id)}
                      isLoading={cancelMutation.isPending}
                      className="bg-[#E03E3E] hover:bg-red-750 text-white font-bold text-xs h-9 px-6 rounded-md cursor-pointer border-none shadow-none shrink-0"
                    >
                      Cancel
                    </Button>
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="bg-[#faeaea] text-[#E03E3E] hover:bg-[#f3d6d6] font-bold text-xs h-9 px-6 rounded-md cursor-pointer border-none shadow-none shrink-0"
                    >
                      <Link href="/dashboard/appointments">Re-schedule</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 border border-gray-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.01)] rounded-md h-[213px]">
              <div className="w-12 h-12 rounded-md bg-[#fcdede] text-[#E03E3E] flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="max-w-md">
                <h3 className="font-extrabold text-gray-900 text-sm">No Upcoming Appointments</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1.5 px-4">
                  Ready for your next checkup? Book a consultation with one of our eye care specialists today.
                </p>
              </div>
              <Button asChild variant="default" className="h-9 px-6 text-xs font-bold rounded-md bg-[#E03E3E] text-white">
                <Link href="/dashboard/appointments">Book Appointment</Link>
              </Button>
            </Card>
          )}
        </div>

        {/* Messages */}
        <div className="lg:col-span-4 flex flex-col h-full">
          <div className="mb-4 flex items-center gap-2 shrink-0">
            <MessageSquare className="w-5 h-5 text-gray-650" />
            <h3 className="font-extrabold text-gray-955 text-base">Messages</h3>
          </div>

          <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex-grow flex flex-col justify-between min-h-[260px]">
            {conversationsLoading ? (
              <div className="flex-grow flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" />
              </div>
            ) : conversations.length > 0 ? (
              <div className="flex flex-col flex-grow justify-between">
                <div className="space-y-4 flex-grow">
                  {conversations.slice(0, 2).map(conv => (
                    <Link
                      key={conv.id}
                      href="/dashboard/messages"
                      className="flex items-start gap-3.5 pb-4 border-b border-gray-50 last:border-none last:pb-0 hover:bg-gray-50/50 p-2 rounded-md transition-colors"
                    >
                      <Avatar
                        src={conv.assigned_doctor?.avatar}
                        fallback={conv.assigned_doctor ? `${conv.assigned_doctor.first_name} ${conv.assigned_doctor.last_name}` : 'Staff'}
                        size="sm"
                      />
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-gray-955 text-xs truncate">
                            {conv.assigned_doctor
                              ? `Dr. ${conv.assigned_doctor.first_name} ${conv.assigned_doctor.last_name}`
                              : 'Support Desk'}
                          </h4>
                          <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap ml-1">
                            {getFormattedMessageTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {conv.last_message?.content || 'No messages yet.'}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 self-center animate-pulse" />
                      )}
                    </Link>
                  ))}
                </div>
                <Link
                  href="/dashboard/messages"
                  className="text-xs font-bold text-[#E03E3E] hover:underline block text-center mt-4 pt-3 border-t border-gray-50"
                >
                  View All Messages
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 flex-grow">
                <div className="w-12 h-12 rounded-md bg-[#fcdede] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Inbox is empty</h3>
                  <p className="text-xs text-gray-500 leading-relaxed px-4 mt-1.5">
                    Have a question? Send a direct message to our care team anytime.
                  </p>
                </div>
                <Button asChild variant="link" className="text-[#E03E3E] font-bold text-xs p-0 h-auto">
                  <Link href="/dashboard/messages">Start Conversation</Link>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Row 3: Current Prescription (Left) & Health Care News & Tips (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Current Prescription */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="mb-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-gray-650" />
              <h3 className="font-extrabold text-gray-955 text-base">Current Prescription</h3>
            </div>
            {activePrescriptions.length > 0 && (
              <Link href="/dashboard/records" className="text-xs font-bold text-[#E03E3E] hover:underline">
                View All Records
              </Link>
            )}
          </div>

          <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex-grow min-h-[220px] flex flex-col justify-center">
            {prescriptionsLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" />
              </div>
            ) : activePrescriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {activePrescriptions.slice(0, 2).map(p => (
                  <Card
                    key={p.id}
                    className="p-5 border border-gray-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.005)] rounded-md flex flex-col justify-between h-48"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="w-8 h-8 rounded-md bg-[#faeaea] text-[#E03E3E] flex items-center justify-center">
                          <Link2 className="w-4 h-4 rotate-45" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-650">Active</span>
                      </div>
                      <h4 className="font-extrabold text-gray-955 text-xs">Daily Distance Wear</h4>
                      <p className="text-[9px] text-gray-400 font-bold mt-0.5">Ref: #RX-{p.id.slice(0, 8).toUpperCase()}</p>
                      <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-2 text-[10px] font-bold text-gray-500 gap-2">
                        <div>
                          OD (Right): <span className="text-gray-900 font-extrabold">{p.right_sph ? `${p.right_sph}SPH` : '0.00'}</span>
                        </div>
                        <div>
                          OS (Left): <span className="text-gray-900 font-extrabold">{p.left_sph ? `${p.left_sph}SPH` : '0.00'}</span>
                        </div>
                      </div>
                    </div>
                    {p.prescription_file && (
                      <a
                        href={p.prescription_file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#E03E3E] hover:underline mt-4 pt-3 border-t border-gray-50 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                <div className="w-12 h-12 rounded-md bg-[#fcdede] text-[#E03E3E] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div className="max-w-md">
                  <h3 className="font-extrabold text-gray-900 text-sm">No Prescription Found</h3>
                  <p className="text-xs text-gray-550 leading-relaxed mt-1.5 px-4">
                    Your vision records and prescriptions will appear here after your first comprehensive examination.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Blog / News Widget */}
        <div className="lg:col-span-4 flex flex-col h-full">
          <BlogWidget />
        </div>
      </div>
    </div>
  );
}
