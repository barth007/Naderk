"use client";

import React from 'react';
import { useAppointmentHistory, useCancelAppointment, useDeleteAppointment } from '@/services/appointments/appointments.hooks';
import { toast } from 'sonner';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Appointment } from '@/services/appointments/appointments.types';
import { ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useBookingStore } from '@/store/useBookingStore';
import RescheduleModal from '@/components/appointments/RescheduleModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AppointmentCard from '@/components/appointments/AppointmentCard';
import AppointmentHistoryTable from '@/components/appointments/AppointmentHistoryTable';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { useState } from 'react';

export default function AppointmentsHistoryPage() {
  const { data: history, isLoading, isError } = useAppointmentHistory();
  const cancelMutation = useCancelAppointment();
  const deleteMutation = useDeleteAppointment();
  const resetBooking = useBookingStore(state => state.resetBooking);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);

  const handleCancel = (id: string) => {
    setAppointmentToCancel(id);
  };

  const confirmCancel = () => {
    if (!appointmentToCancel) return;
    cancelMutation.mutate(appointmentToCancel, {
      onSuccess: () => {
        toast.success('Appointment cancelled successfully');
        setAppointmentToCancel(null);
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel appointment')
    });
  };

  const handleDelete = (id: string) => {
    setAppointmentToDelete(id);
  };

  const confirmDelete = () => {
    if (!appointmentToDelete) return;
    deleteMutation.mutate(appointmentToDelete, {
      onSuccess: () => {
        toast.success('Appointment deleted successfully');
        setAppointmentToDelete(null);
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete appointment')
    });
  };

  const handleReschedule = (apt: Appointment) => {
    setRescheduleAppointment(apt);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-8">
          <Breadcrumbs />
        </div>

        {/* Header (only show if not completely empty or loading) */}
        {(!history || (history.upcoming.length > 0 || history.past.length > 0)) && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
              <p className="mt-2 text-gray-600">Manage and track your eye care schedule</p>
            </div>
            <Link href="/dashboard/appointments/book" onClick={() => resetBooking()} className="bg-[#E03E3E] hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-md shadow transition-colors">
              Book New Appointment
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-md"></div>)}
          </div>
        ) : isError ? (
          <div className="p-8 text-center bg-white rounded-md shadow-sm text-red-500">
            Failed to load your appointments. Please try again later.
          </div>
        ) : history?.upcoming.length === 0 && history?.past.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 sm:py-10">
            <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6 sm:p-12 max-w-2xl w-full text-center flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 rounded-md flex items-center justify-center mb-6">
                <CalendarIcon className="w-8 h-8 sm:w-10 sm:h-10 text-[#E03E3E]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">No appointments yet.</h2>
              <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8 max-w-md">
                Your schedule is currently clear. Regular eye exams are key to maintaining long-term vision health. Would you like to schedule your first check up with our specialists?
              </p>
              <Link href="/dashboard/appointments/book" onClick={() => resetBooking()} className="w-full sm:w-auto bg-[#E03E3E] hover:bg-red-700 text-white font-medium py-3 px-8 rounded-md shadow transition-colors">
                Book First Appointment
              </Link>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="flex -space-x-3">
                <img className="w-10 h-10 rounded-md border-2 border-white object-cover shadow-sm" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&auto=format&fit=crop&q=60" alt="Doctor" />
                <img className="w-10 h-10 rounded-md border-2 border-white object-cover bg-yellow-100 shadow-sm" src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&auto=format&fit=crop&q=60" alt="Doctor" />
                <img className="w-10 h-10 rounded-md border-2 border-white object-cover bg-green-100 shadow-sm" src="https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=100&auto=format&fit=crop&q=60" alt="Doctor" />
                <img className="w-10 h-10 rounded-md border-2 border-white object-cover bg-blue-100 shadow-sm" src="https://images.unsplash.com/photo-1594824432258-0ce5535508cd?w=100&auto=format&fit=crop&q=60" alt="Doctor" />
              </div>
              <p className="text-[13px] sm:text-sm text-gray-500 text-center sm:text-left">
                <span className="text-[#E03E3E] font-medium">12 Specialists</span> available for consultation this week.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">

            {/* Main Content (Left Column) */}
            <div className="flex-1 lg:max-w-[70%] space-y-10">

              {/* Upcoming Appointments */}
              <div>
                <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-4">Next Scheduled Visit</h2>

                {history?.upcoming.length === 0 ? (
                  <div className="bg-white p-8 rounded-md border border-gray-100 text-center shadow-sm">
                    <p className="text-gray-500 mb-4">You have no upcoming appointments.</p>
                    <Link href="/dashboard/appointments/book" onClick={() => resetBooking()} className="text-[#E03E3E] font-medium hover:underline">
                      Schedule a visit now
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history?.upcoming.map((apt: Appointment, idx: number) => (
                      <AppointmentCard 
                        key={apt.id}
                        apt={apt}
                        isPrimary={idx === 0}
                        onReschedule={handleReschedule}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        isCancelPending={cancelMutation.isPending}
                        isDeletePending={deleteMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Past Appointments */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Recent Past Visits</h2>
                  <button className="text-[#E03E3E] text-[13px] font-bold hover:underline">View All History</button>
                </div>

                <AppointmentHistoryTable history={history?.past || []} />
              </div>

            </div>

            {/* Sidebar (Right Column) */}
            <div className="lg:w-[30%] lg:min-w-[320px] space-y-6">

              {/* Banner */}
              <div className="relative rounded-md overflow-hidden bg-gray-900 shadow-sm p-6 text-white min-h-[160px] flex flex-col justify-center">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=500&auto=format&fit=crop&q=60')] bg-cover bg-center opacity-40"></div>
                <div className="relative z-10">
                  <h3 className="font-bold text-lg leading-tight mb-2">Need a new appointment?</h3>
                  <p className="text-gray-200 text-[13px] mb-5 max-w-[200px]">Book a visit with our specialists in just a few clicks.</p>
                  <Link href="/dashboard/appointments/book" onClick={() => resetBooking()} className="inline-block bg-[#E03E3E] hover:bg-red-700 text-white text-[13px] font-bold py-2.5 px-6 rounded-md transition-colors shadow-sm">
                    Schedule Now
                  </Link>
                </div>
              </div>

              {/* Need Help Card */}
              <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  <h3 className="font-bold text-gray-900 text-[15px]">Need Help?</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3">Main Clinic Contact</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-md bg-[#FEF6F6] flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-[#E03E3E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-[14px]">+234 81234567890</p>
                          <p className="text-gray-500 text-[12px] mt-0.5">Mon-Fri 8AM-6PM</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-md bg-[#FEF6F6] flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-[#E03E3E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-[14px]">info@naderkeye.com</p>
                          <p className="text-gray-500 text-[12px] mt-0.5">Response within 24 hours</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Card */}
              <div>
                <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3">Location</h4>
                <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
                  <div className="h-[140px] bg-gray-100 relative">
                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=500&auto=format&fit=crop&q=60" alt="Map" className="w-full h-full object-cover" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <svg className="w-8 h-8 text-[#E03E3E] drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-[14px] font-bold text-gray-900">123 Medical Street Abuja</p>
                  </div>
                </div>
              </div>

              {/* Patient's Resources */}
              <div className="bg-white rounded-md border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 text-[15px] mb-4">Patient's Resources</h3>
                <div className="space-y-1">
                  <Link href="#" className="flex items-center justify-between py-2 text-[13px] text-gray-600 hover:text-gray-900 group">
                    <span>Pre-appointment guide</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
                  </Link>
                  <Link href="#" className="flex items-center justify-between py-2 text-[13px] text-gray-600 hover:text-gray-900 group">
                    <span>Insurance information</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
                  </Link>
                  <Link href="#" className="flex items-center justify-between py-2 text-[13px] text-gray-600 hover:text-gray-900 group">
                    <span>Eye care tips</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
                  </Link>
                </div>
              </div>

            </div>

          </div>
        )}
      </div>

      <RescheduleModal 
        isOpen={!!rescheduleAppointment} 
        onClose={() => setRescheduleAppointment(null)} 
        appointment={rescheduleAppointment} 
      />

      <ConfirmationModal
        isOpen={!!appointmentToCancel}
        onClose={() => setAppointmentToCancel(null)}
        onConfirm={confirmCancel}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment? This action cannot be undone."
        confirmText="Yes, Cancel"
        isPending={cancelMutation.isPending}
      />

      <ConfirmationModal
        isOpen={!!appointmentToDelete}
        onClose={() => setAppointmentToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Appointment"
        description="Are you sure you want to delete this appointment from your history? This action cannot be undone."
        confirmText="Yes, Delete"
        isPending={deleteMutation.isPending}
        confirmButtonVariant="secondary"
      />
    </div>
  );
}
