// app/doctor/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  format, startOfMonth, startOfWeek, addDays,
  isSameMonth, isSameDay, subMonths, addMonths
} from 'date-fns';
import {
  Users, Calendar, Clock, CheckCircle2, XCircle,
  Video, Clipboard, FileText, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import { Table, TableBody, TableRow, Th, Td } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';

// Skeletons and error handlers
const WidgetSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-24 bg-gray-50 rounded-md w-full border border-gray-100"></div>
    <div className="h-24 bg-gray-50 rounded-md w-full border border-gray-100"></div>
  </div>
);

const WidgetError = ({ message, onRetry }: { message: string, onRetry?: () => void }) => (
  <Card className="p-6 text-center flex flex-col items-center justify-center border border-red-100 bg-red-50/10 rounded-md min-h-[200px]">
    <div className="w-12 h-12 bg-red-50 rounded-md flex items-center justify-center mb-4 text-[#E03E3E]">
      <AlertTriangle className="w-5 h-5" />
    </div>
    <h3 className="font-bold text-gray-900 text-sm mb-1.5">Failed to load data</h3>
    <p className="text-gray-500 text-xs mt-0.5 max-w-xs leading-relaxed mb-4">{message}</p>
    {onRetry && (
      <Button
        onClick={onRetry}
        size="sm"
        variant="outline"
        className="h-8 px-4 text-xs font-semibold rounded-md border-gray-200 hover:bg-gray-55 text-gray-750 shadow-none cursor-pointer"
      >
        Retry
      </Button>
    )}
  </Card>
);

const KPICardSkeleton = () => (
  <div className="h-24 bg-gray-50 rounded-md w-full animate-pulse border border-gray-100"></div>
);

export default function DoctorDashboardPage() {
  const { user } = useAuth();

  // Widget states
  const [summaryState, setSummaryState] = useState({
    loading: true,
    error: false,
    data: {
      total_appointments: 0,
      appointments_today: 0,
      new_appointments: 0,
      cancelled_appointments: 0,
      active_conversations: 0,
      missed_sessions: 0
    }
  });

  const [appointmentsState, setAppointmentsState] = useState<{ loading: boolean; error: boolean; data: any[] }>({
    loading: true,
    error: false,
    data: []
  });

  const [requestsState, setRequestsState] = useState<{ loading: boolean; error: boolean; data: any[] }>({
    loading: true,
    error: false,
    data: []
  });

  const [calendarState, setCalendarState] = useState<{ loading: boolean; error: boolean; data: any[] }>({
    loading: true,
    error: false,
    data: []
  });

  const [noteState, setNoteState] = useState({
    loading: true,
    error: false,
    content: "",
    saving: false
  });

  // Calendar month state
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Fetch functions
  const fetchSummary = async () => {
    setSummaryState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await apiClient.get('/dashboard/doctor/summary/');
      setSummaryState({ loading: false, error: false, data: res.data.data });
    } catch (error) {
      console.error("Error loading summary statistics:", error);
      setSummaryState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchAppointments = async () => {
    setAppointmentsState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await apiClient.get('/dashboard/doctor/appointments/');
      setAppointmentsState({ loading: false, error: false, data: res.data.data || [] });
    } catch (error) {
      console.error("Error loading appointments queue:", error);
      setAppointmentsState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchRequests = async () => {
    setRequestsState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await apiClient.get('/dashboard/doctor/requests/');
      setRequestsState({ loading: false, error: false, data: res.data.data || [] });
    } catch (error) {
      console.error("Error loading requests queue:", error);
      setRequestsState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchCalendar = async () => {
    setCalendarState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await apiClient.get('/dashboard/doctor/calendar/');
      setCalendarState({ loading: false, error: false, data: res.data.data || [] });
    } catch (error) {
      console.error("Error loading calendar bookings:", error);
      setCalendarState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchNote = async () => {
    setNoteState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await apiClient.get('/dashboard/doctor/scratchpad/');
      setNoteState({ loading: false, error: false, content: res.data?.data?.content || "", saving: false });
    } catch (error) {
      console.error("Error loading scratchpad note:", error);
      setNoteState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchAppointments();
    fetchRequests();
    fetchCalendar();
    fetchNote();
  }, []);

  const handleAcceptRequest = async (id: string) => {
    try {
      await apiClient.post(`/dashboard/doctor/requests/${id}/accept/`);
      toast.success("Appointment request accepted!");
      fetchRequests();
      fetchAppointments();
      fetchSummary();
      fetchCalendar();
    } catch (error) {
      toast.error("Failed to accept request.");
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      await apiClient.post(`/dashboard/doctor/requests/${id}/reject/`);
      toast.success("Appointment request rejected.");
      fetchRequests();
      fetchSummary();
    } catch (error) {
      toast.error("Failed to reject request.");
    }
  };

  const handleSaveNote = async () => {
    setNoteState(prev => ({ ...prev, saving: true }));
    try {
      await apiClient.post('/dashboard/doctor/scratchpad/', { content: noteState.content });
      toast.success("Scratchpad notes updated!");
    } catch (error) {
      toast.error("Failed to save note.");
    } finally {
      setNoteState(prev => ({ ...prev, saving: false }));
    }
  };

  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const computeGreeting = () => {
      const hr = new Date().getHours();
      if (hr < 12) return 'Good Morning';
      if (hr < 17) return 'Good Afternoon';
      return 'Good Evening';
    };
    setGreeting(computeGreeting());
    const interval = setInterval(() => setGreeting(computeGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Calendar setup using date-fns
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday-first
  const calendarDays = Array.from({ length: 42 }).map((_, i) => addDays(startDate, i));

  // Resolve highlighted dates from backend data
  const getBookingsForDate = (dateStr: string) => {
    const backendBookings = calendarState.data.filter(b => b.date === dateStr);
    return backendBookings.map(b => ({
      type: b.type === 'TELEHEALTH' ? 'telehealth' : (b.type === 'EMERGENCY' || b.title.toLowerCase().includes('surgery') ? 'surgery' : 'eye-exam')
    }));
  };

  // Mapped KPI stats from backend
  const stats = [
    { label: 'Total Appointments', value: String(summaryState.data.total_appointments), change: '+12%', trend: 'up', iconBg: 'bg-red-50 text-[#E03E3E]', icon: <Clipboard className="w-5 h-5" /> },
    { label: 'Appointments Today', value: String(summaryState.data.appointments_today), change: '+12%', trend: 'up', iconBg: 'bg-green-50 text-green-600', icon: <Calendar className="w-5 h-5" /> },
    { label: 'New Appointments', value: String(summaryState.data.new_appointments), change: '-12%', trend: 'down', iconBg: 'bg-red-50 text-[#E03E3E]', icon: <Users className="w-5 h-5" /> },
    { label: 'Active Chats', value: String(summaryState.data.active_conversations), change: '-12%', trend: 'down', iconBg: 'bg-red-50 text-[#E03E3E]', icon: <MessageSquare className="w-5 h-5" /> },
    { label: 'Cancelled Appointments', value: String(summaryState.data.cancelled_appointments), change: '+12%', trend: 'up', iconBg: 'bg-green-50 text-green-600', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Missed Sessions', value: String(summaryState.data.missed_sessions), change: '+12%', trend: 'up', iconBg: 'bg-green-50 text-green-600', icon: <Calendar className="w-5 h-5" /> },
  ];

  // Formatter helpers
  const formatDateTime = (dateStr: string, timeStr: string) => {
    try {
      const dt = new Date(`${dateStr}T${timeStr}`);
      if (!isNaN(dt.getTime())) {
        return format(dt, 'MMM dd, yyyy h:mm a');
      }
    } catch { }
    return `${dateStr} at ${timeStr}`;
  };

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



  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 select-none">

      {/* Dashboard Greeting Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
          {greeting}, Dr. {user?.last_name || "Nader"}
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 font-semibold">
          An overview of your patient's dashboard
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {summaryState.loading ? (
          Array.from({ length: 6 }).map((_, idx) => <KPICardSkeleton key={idx} />)
        ) : summaryState.error ? (
          <div className="col-span-full py-4 text-center text-xs text-red-500 bg-red-50/30 rounded-md border border-red-100">
            Failed to load KPI summary data.
          </div>
        ) : (
          stats.map((card, idx) => (
            <Card key={idx} className="p-5 flex flex-col justify-between bg-white border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.015)] rounded-md h-32">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 font-bold block">{card.label}</span>
                  <span className="text-2xl font-black text-gray-900 block">{card.value}</span>
                </div>
                <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  {card.icon}
                </div>
              </div>
              <div className="flex justify-between items-center w-full mt-2">
                <span className="text-[10px] text-gray-400 font-bold">This year</span>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-green-50 text-green-650">
                  {card.change}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Row 3: Marked Bookings (Calendar) & Appointment Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Calendar Column - 8 cols */}
        <div className="lg:col-span-8 flex flex-col h-full">
          {/* Card Title Outside/Above Card */}
          <div className="mb-4 shrink-0">
            <h3 className="font-extrabold text-gray-950 text-base">Marked Bookings</h3>
          </div>

          <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between flex-grow">
            <div className="space-y-4">
              {/* Calendar Header Navigation */}
              <div className="flex justify-between items-center py-2 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="h-8 w-8 rounded-md text-gray-400 hover:text-gray-900 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="font-extrabold text-gray-800 text-sm tracking-wide">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextMonth}
                  className="h-8 w-8 rounded-md text-gray-400 hover:text-gray-900 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 text-center text-xs font-bold pb-2 border-b border-gray-50">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <span key={day} className={
                    day === 'Tue' ? 'text-sky-500' :
                      day === 'Thu' ? 'text-[#E03E3E]' :
                        day === 'Fri' ? 'text-indigo-600' : 'text-gray-500'
                  }>
                    {day}
                  </span>
                ))}
              </div>

              {/* Calendar Grid using date-fns */}
              <div className="grid grid-cols-7 gap-y-4 text-center text-xs font-bold mt-4">
                {calendarDays.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const bookings = getBookingsForDate(dateStr);
                  const hasBookings = bookings.length > 0;

                  let dayColorClass = 'text-gray-850 hover:bg-gray-55/40 transition-colors rounded-md cursor-pointer py-1 relative group';

                  if (hasBookings) {
                    const type = bookings[0].type;
                    if (type === 'surgery') {
                      dayColorClass = 'text-[#E03E3E] font-black py-1 relative group cursor-pointer hover:bg-red-50/50 rounded-md';
                    } else if (type === 'telehealth') {
                      dayColorClass = 'text-sky-500 font-black py-1 relative group cursor-pointer hover:bg-sky-50/50 rounded-md';
                    } else if (type === 'eye-exam') {
                      dayColorClass = 'text-indigo-700 font-black py-1 relative group cursor-pointer hover:bg-indigo-50/50 rounded-md';
                    }
                    if (!isCurrentMonth) {
                      dayColorClass += ' opacity-50';
                    }
                  } else if (!isCurrentMonth) {
                    dayColorClass = 'text-gray-300 py-1';
                  }

                  return (
                    <div key={date.toISOString()} className={dayColorClass}>
                      {format(date, 'dd')}
                      
                      {hasBookings && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900/95 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-50 w-48 text-left pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 border border-gray-800">
                          <div className="font-extrabold border-b border-gray-800 pb-1 mb-1 text-gray-400 uppercase tracking-wider text-[9px] flex justify-between">
                            <span>{format(date, 'MMM dd, yyyy')}</span>
                            <span className="text-gray-500">{bookings.length} {bookings.length === 1 ? 'Booking' : 'Bookings'}</span>
                          </div>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {calendarState.data.filter(b => b.date === dateStr).map((b, idx) => (
                              <div key={b.id || idx} className="flex flex-col border-b border-gray-800/50 last:border-none pb-1 last:pb-0">
                                <span className="font-extrabold text-white leading-tight truncate">{b.title}</span>
                                <span className="text-gray-400 text-[9px] mt-0.5 flex justify-between">
                                  <span>{formatTime(b.time)}</span>
                                  <span className="capitalize text-sky-400 font-bold">{b.type.toLowerCase()}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                          {/* Arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-gray-900 rotate-45 border-r border-b border-gray-800" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calendar Legend */}
            <div className="flex justify-center gap-6 text-[10px] font-bold text-gray-400 border-t border-gray-50 pt-5 mt-6">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-[#E03E3E]" />
                <span>Surgery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-sky-500" />
                <span>Telehealth</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-indigo-600" />
                <span>Eye Exam</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Appointment's Request Widget Column - 4 cols */}
        <div className="lg:col-span-4 flex flex-col h-full">
          {/* Card Title Outside/Above Card */}
          <div className="flex items-center justify-between mb-4 shrink-0 h-[28px]">
            <h3 className="font-extrabold text-gray-955 text-base">Appointment’s Request</h3>
            <Link href="/doctor/records" className="text-xs font-bold text-[#E03E3E] hover:underline">
              View All
            </Link>
          </div>

          <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col flex-grow">
            <div className="space-y-5 overflow-y-auto flex-grow max-h-[310px] pr-1">
              {requestsState.loading ? (
                <WidgetSkeleton />
              ) : requestsState.error ? (
                <WidgetError message="Failed to load appointment requests." onRetry={fetchRequests} />
              ) : requestsState.data.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-12 font-semibold">
                  No pending requests
                </div>
              ) : (
                requestsState.data.map((req) => (
                  <div key={req.id} className="flex items-start gap-3.5 pb-5 border-b border-gray-50">
                    <Avatar
                      src={req.patient_avatar}
                      fallback={req.patient_name}
                      size="sm"
                    />

                    <div className="flex-grow min-w-0">
                      <h4 className="font-extrabold text-gray-950 text-sm leading-tight truncate">{req.patient_name}</h4>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">{req.service_name}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        {formatDateTime(req.date, req.time)}
                      </p>

                      {/* Branded Buttons */}
                      <div className="flex gap-3 mt-3 w-full">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRejectRequest(req.id)}
                          className="font-bold text-xs h-9 rounded-md flex-1 cursor-pointer border-none shadow-none"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAcceptRequest(req.id)}
                          className="bg-[#E03E3E] hover:bg-red-750 text-white font-bold text-xs h-9 rounded-md flex-1 cursor-pointer border-none shadow-none"
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

      </div>

      {/* Row 4: Today's Queue & Scratchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Patient's Queue & Appointments - 8 cols */}
        <div className="lg:col-span-8 flex flex-col h-full">
          {/* Card Title Outside/Above Card */}
          <div className="mb-4 shrink-0">
            <h3 className="font-extrabold text-gray-955 text-base">Patient's Queue & Appointments</h3>
            <p className="text-gray-400 text-xs mt-0.5 font-bold">Scheduled list for today</p>
          </div>

          <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between flex-grow">
            <div className="overflow-x-auto w-full">
              <Table className="w-full text-left text-xs font-semibold text-gray-650 border-collapse">
                <thead>
                  <TableRow className="border-b border-gray-50 text-[10px] text-gray-400 font-extrabold tracking-wider bg-transparent hover:bg-transparent">
                    <Th className="py-3 px-4 bg-transparent text-gray-400 font-extrabold border-none shadow-none">Patient's Name</Th>
                    <Th className="py-3 px-4 bg-transparent text-gray-400 font-extrabold border-none shadow-none">Severity</Th>
                    <Th className="py-3 px-4 bg-transparent text-gray-400 font-extrabold border-none shadow-none">Category</Th>
                    <Th className="py-3 px-4 bg-transparent text-gray-400 font-extrabold border-none shadow-none">Date & Time</Th>
                    <Th className="py-3 px-4 bg-transparent text-gray-400 font-extrabold border-none shadow-none text-right justify-end">Type</Th>
                  </TableRow>
                </thead>
                <TableBody className="divide-y divide-gray-50 border-none">
                  {appointmentsState.loading ? (
                    <TableRow className="hover:bg-transparent">
                      <Td colSpan={5} className="py-8 text-center border-none">
                        <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E] mx-auto" />
                      </Td>
                    </TableRow>
                  ) : appointmentsState.error ? (
                    <TableRow className="hover:bg-transparent">
                      <Td colSpan={5} className="py-8 text-center text-red-500 font-bold border-none">
                        Failed to load today's appointments
                      </Td>
                    </TableRow>
                  ) : appointmentsState.data.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <Td colSpan={5} className="py-8 border-none">
                        <EmptyState role="DOCTOR" configKey="NO_PATIENTS" />
                      </Td>
                    </TableRow>
                  ) : (
                    appointmentsState.data.map((appt) => (
                      <TableRow key={appt.id} className="hover:bg-gray-55/10 transition-colors border-b border-gray-50 last:border-none">
                        <Td className="py-4.5 px-4 text-gray-700 border-none">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={appt.patient_avatar}
                              fallback={appt.patient_name}
                              size="sm"
                            />
                            <div className="flex flex-col text-left">
                              <span className="font-extrabold text-gray-900 leading-tight">{appt.patient_name}</span>
                              <span className="text-[10px] text-gray-400 font-bold mt-0.5">Compliant: {appt.consultation_type}</span>
                            </div>
                          </div>
                        </Td>
                        <Td className="py-4.5 px-4 text-gray-700 border-none">
                          {appt.severity === 'Routine' || appt.severity === 'Normal' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold border border-indigo-100 bg-indigo-50/50 text-indigo-700">
                              <span className="w-1.5 h-1.5 rounded-md bg-indigo-500" />
                              Routine
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold border border-red-100 bg-red-50/50 text-[#E03E3E]">
                              <span className="w-1.5 h-1.5 rounded-md bg-[#E03E3E]" />
                              {appt.severity}
                            </span>
                          )}
                        </Td>
                        <Td className="py-4.5 px-4 text-gray-500 font-bold border-none">{appt.category || 'Follow Up'}</Td>
                        <Td className="py-4.5 px-4 text-gray-500 font-bold border-none">
                          {format(new Date(), 'MMM dd, yyyy')}, {formatTime(appt.time)}
                        </Td>
                        <Td className="py-4.5 px-4 text-right border-none">
                          {appt.telehealth ? (
                            <Video className="w-5 h-5 text-[#E03E3E] inline animate-pulse" />
                          ) : (
                            <Users className="w-5 h-5 text-gray-400 inline" />
                          )}
                        </Td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Clinical Scratchpad Column - 4 cols */}
        <div className="lg:col-span-4 flex flex-col h-full min-h-[320px]">
          {/* Card Title Outside/Above Card - aligned with table grid baseline */}
          <div className="mb-4 flex flex-col justify-end shrink-0 h-[48px]">
            <h3 className="font-extrabold text-gray-955 text-base">Clinical Scratchpad</h3>
          </div>

          <Card className="p-6 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between flex-grow">
            <div className="space-y-4 flex-grow flex flex-col">
              {noteState.loading ? (
                <div className="flex-grow flex items-center justify-center bg-gray-50/50 rounded-md border border-gray-100">
                  <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" />
                </div>
              ) : noteState.error ? (
                <div className="flex-grow p-4 flex flex-col items-center justify-center bg-red-50/10 rounded-md border border-red-100 text-center">
                  <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
                  <p className="text-xs text-red-655 font-bold">Failed to load scratchpad notes.</p>
                </div>
              ) : (
                <textarea
                  className="w-full flex-grow rounded-md border border-gray-200 p-4 text-xs focus:ring-[#E03E3E] focus:border-[#E03E3E] focus:ring-1 focus:bg-white resize-none outline-none font-semibold text-gray-700 bg-gray-50/30 min-h-[160px]"
                  placeholder="Quickly jot down notes or patient's follow-ups..."
                  value={noteState.content}
                  onChange={(e) => setNoteState(prev => ({ ...prev, content: e.target.value }))}
                />
              )}
            </div>

            <div className="flex justify-end mt-4">
              <Button
                variant="default"
                onClick={handleSaveNote}
                isLoading={noteState.saving}
                disabled={noteState.loading || noteState.error}
                className="bg-[#E03E3E] hover:bg-red-750 text-white font-bold text-xs px-5 h-9 rounded-md border-none cursor-pointer"
              >
                Save To Inbox
              </Button>
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
}
