'use client';

import React, { useState, useMemo } from 'react';
import {
  format, startOfMonth, startOfWeek, addDays,
  isSameMonth, isSameDay, subMonths, addMonths,
} from 'date-fns';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Lock, Clock, X, AlertTriangle, Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
  useAdminAppointmentRequests,
  useAdminAppointmentCalendar,
  useAdminScheduleAppointment,
  useAdminDoctors,
  useAdminCancelAppointment,
  useAdminRescheduleAppointment,
  AdminAppointmentRequest,
  AdminCalendarAppointment,
} from '@/services/admin/admin-appointments.hooks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}S AGO`;
  if (diff < 3600) return `${Math.round(diff / 60)}M AGO`;
  if (diff < 86400) return `${Math.round(diff / 3600)}H AGO`;
  return `${Math.round(diff / 86400)}D AGO`;
}

type DotType = 'surgery' | 'telehealth' | 'eye-exam';

function dotTypeFromAppt(type: string): DotType {
  if (type === 'TELEHEALTH') return 'telehealth';
  if (type === 'EMERGENCY') return 'surgery';
  return 'eye-exam';
}

const DOT_COLORS: Record<DotType, string> = {
  surgery: '#E03E3E',
  telehealth: '#38bdf8',
  'eye-exam': '#4338ca',
};

// ─── Schedule Modal ────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  isOpen: boolean;
  appointment: AdminAppointmentRequest | null;
  onClose: () => void;
}

function ScheduleModal({ isOpen, appointment, onClose }: ScheduleModalProps) {
  const { data: doctors = [], isLoading: loadingDoctors } = useAdminDoctors();
  const scheduleMutation = useAdminScheduleAppointment();

  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(appointment?.appointment_date ?? '');
  const [time, setTime] = useState(appointment?.appointment_time?.substring(0, 5) ?? '');

  // Reset when appointment changes
  React.useEffect(() => {
    if (appointment) {
      setDoctorId(appointment.doctor_id ?? '');
      setDate(appointment.appointment_date ?? '');
      setTime(appointment.appointment_time?.substring(0, 5) ?? '');
    }
  }, [appointment?.id]);

  async function handleConfirm() {
    if (!appointment) return;
    if (!doctorId || !date || !time) {
      toast.error('Please fill in all fields.');
      return;
    }
    try {
      await scheduleMutation.mutateAsync({
        appointmentId: appointment.id,
        doctor_id: doctorId,
        date,
        time: time.length === 5 ? `${time}:00` : time,
      });
      toast.success('Appointment scheduled successfully.');
      onClose();
    } catch {
      toast.error('Failed to schedule appointment.');
    }
  }

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-md rounded-xl bg-white">
        <h3 className="font-bold text-lg text-gray-900 mb-1">
          {appointment?.is_emergency ? 'Priority Assign' : 'Schedule Appointment'}
        </h3>
        {appointment && (
          <p className="text-sm text-gray-500 mb-4">
            {appointment.patient_name} — {appointment.service_name}
          </p>
        )}

        <div className="space-y-4">
          {/* Doctor */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Assign Doctor</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/30"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              disabled={loadingDoctors}
            >
              <option value="">— Select a doctor —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/30"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Time</label>
            <input
              type="time"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/30"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-action mt-6">
          <Button variant="outline" onClick={onClose} className="border-gray-200 text-gray-600">
            Cancel
          </Button>
          <Button
            className="bg-[#E03E3E] hover:bg-[#c93535] text-white font-semibold"
            onClick={handleConfirm}
            disabled={scheduleMutation.isPending}
            isLoading={scheduleMutation.isPending}
            loadingText="Scheduling..."
          >
            Confirm Schedule
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

// ─── Reschedule Modal ──────────────────────────────────────────────────────────

interface RescheduleModalProps {
  isOpen: boolean;
  appointmentId: string | null;
  onClose: () => void;
}

function RescheduleModal({ isOpen, appointmentId, onClose }: RescheduleModalProps) {
  const rescheduleMutation = useAdminRescheduleAppointment();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  async function handleConfirm() {
    if (!appointmentId || !date || !time) {
      toast.error('Please fill in both date and time.');
      return;
    }
    try {
      await rescheduleMutation.mutateAsync({
        appointmentId,
        date,
        time: time.length === 5 ? `${time}:00` : time,
      });
      toast.success('Appointment rescheduled.');
      setDate(''); setTime('');
      onClose();
    } catch {
      toast.error('Failed to reschedule appointment.');
    }
  }

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm rounded-xl bg-white">
        <h3 className="font-bold text-lg text-gray-900 mb-4">Reschedule Appointment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">New Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/30"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">New Time</label>
            <input
              type="time"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/30"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-action mt-6">
          <Button variant="outline" onClick={onClose} className="border-gray-200 text-gray-600">Cancel</Button>
          <Button
            className="bg-[#E03E3E] hover:bg-[#c93535] text-white font-semibold"
            onClick={handleConfirm}
            disabled={rescheduleMutation.isPending}
            isLoading={rescheduleMutation.isPending}
            loadingText="Rescheduling..."
          >
            Confirm
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

interface RequestCardProps {
  appt: AdminAppointmentRequest;
  onSchedule: (appt: AdminAppointmentRequest) => void;
  onCancel: (appt: AdminAppointmentRequest) => void;
}

function RequestCard({ appt, onSchedule, onCancel }: RequestCardProps) {
  return (
    <div className="border-l-4 border-[#E03E3E] bg-white rounded-r-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="font-bold text-gray-900 text-sm">{appt.patient_name}</span>
        <span className="text-xs text-[#E03E3E] font-semibold whitespace-nowrap flex-shrink-0">
          {timeAgo(appt.created_at)}
        </span>
      </div>

      {/* Service */}
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-1.5">
        <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span>{appt.service_name}</span>
      </div>

      {/* Preference */}
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span>{appt.preference}</span>
      </div>

      {/* Actions */}
      {appt.is_emergency ? (
        <Button
          className="w-full bg-[#E03E3E] hover:bg-[#c93535] text-white font-semibold text-xs h-8"
          onClick={() => onSchedule(appt)}
        >
          Priority Assign
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-[#E03E3E] hover:bg-[#c93535] text-white font-semibold text-xs h-8"
            onClick={() => onSchedule(appt)}
          >
            Schedule
          </Button>
          <button
            onClick={() => onCancel(appt)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#E03E3E] text-[#E03E3E] hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_COLORS: Record<string, string> = {
  Tue: 'text-sky-500',
  Thu: 'text-[#E03E3E]',
  Fri: 'text-indigo-700',
};

interface CalendarProps {
  allAppointments: AdminCalendarAppointment[];
  onReschedule: (id: string) => void;
}

function AppointmentCalendar({ allAppointments, onReschedule }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tooltip, setTooltip] = useState<{ day: Date; appts: AdminCalendarAppointment[] } | null>(null);

  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = Array.from({ length: 42 }).map((_, i) => addDays(startDate, i));

  // Build map: dateStr -> CalendarAppointment[]
  const byDate = useMemo(() => {
    const map: Record<string, AdminCalendarAppointment[]> = {};
    for (const a of allAppointments) {
      if (!a.date) continue;
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [allAppointments]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="font-bold text-gray-900 text-sm min-w-[110px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4">
          {[
            { label: 'Surgery', color: '#E03E3E' },
            { label: 'Telehealth', color: '#38bdf8' },
            { label: 'Eye Exam', color: '#4338ca' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className={`text-center text-xs font-bold py-2 ${WEEKDAY_COLORS[d] ?? 'text-gray-700'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayAppts = byDate[dateStr] ?? [];
          const isToday = isSameDay(day, today);
          const inMonth = isSameMonth(day, currentMonth);
          const dots = dayAppts
            .slice(0, 3)
            .map((a) => dotTypeFromAppt(a.type));

          return (
            <div
              key={idx}
              className="relative flex flex-col items-center py-2 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => {
                if (dayAppts.length > 0) setTooltip({ day, appts: dayAppts });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <span
                className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-[#E03E3E] text-white font-bold' : ''}
                  ${!inMonth ? 'text-gray-300' : 'text-gray-700'}
                  ${isToday ? '' : inMonth ? 'hover:bg-gray-100' : ''}
                `}
              >
                {format(day, 'd')}
              </span>

              {/* Dots */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dots.map((type, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: DOT_COLORS[type] }}
                    />
                  ))}
                </div>
              )}

              {/* Tooltip */}
              {tooltip && isSameDay(tooltip.day, day) && tooltip.appts.length > 0 && (
                <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-gray-900 text-white text-xs rounded-lg p-3 w-52 shadow-xl pointer-events-none">
                  <p className="font-semibold mb-2">{format(day, 'MMMM d, yyyy')}</p>
                  {tooltip.appts.slice(0, 4).map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: DOT_COLORS[dotTypeFromAppt(a.type)] }}
                      />
                      <span className="truncate">{a.title}</span>
                    </div>
                  ))}
                  {tooltip.appts.length > 4 && (
                    <p className="text-gray-400 text-xs mt-1">+{tooltip.appts.length - 4} more</p>
                  )}
                  <button
                    className="mt-2 text-xs text-[#E03E3E] font-semibold pointer-events-auto"
                    onMouseDown={() => {
                      const first = tooltip.appts[0];
                      if (first) onReschedule(first.id);
                    }}
                  >
                    Reschedule first
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAppointmentsPage() {
  const { data: requests = [], isLoading: loadingRequests } = useAdminAppointmentRequests();
  const { data: calendarAppts = [], isLoading: loadingCalendar } = useAdminAppointmentCalendar();
  const cancelMutation = useAdminCancelAppointment();

  // Modal state
  const [scheduleTarget, setScheduleTarget] = useState<AdminAppointmentRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminAppointmentRequest | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync({ appointmentId: cancelTarget.id, reason: cancelReason });
      toast.success('Appointment cancelled.');
      setCancelTarget(null);
      setCancelReason('');
    } catch {
      toast.error('Failed to cancel appointment.');
    }
  }

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
      {/* Page title */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Appointments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage clinic scheduling and appointment requests</p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Left: Requested panel ── */}
        <div className="w-[320px] flex-shrink-0 flex flex-col">
          <Card className="flex-1 rounded-xl border border-gray-100 shadow-none flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900 text-sm">Requested</h2>
              <p className="text-xs text-gray-400 mt-0.5">External requests from web portal awaiting verification</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingRequests ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 bg-gray-50 rounded-xl animate-pulse border-l-4 border-gray-200" />
                ))
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Calendar className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No pending requests</p>
                </div>
              ) : (
                requests.map((appt) => (
                  <RequestCard
                    key={appt.id}
                    appt={appt}
                    onSchedule={setScheduleTarget}
                    onCancel={setCancelTarget}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* ── Right: Calendar ── */}
        <div className="flex-1 min-w-0">
          <Card className="h-full rounded-xl border border-gray-100 shadow-none p-5 flex flex-col">
            {loadingCalendar ? (
              <div className="flex-1 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <AppointmentCalendar
                allAppointments={calendarAppts}
                onReschedule={(id) => setRescheduleId(id)}
              />
            )}
          </Card>
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Schedule / Priority Assign */}
      <ScheduleModal
        isOpen={!!scheduleTarget}
        appointment={scheduleTarget}
        onClose={() => setScheduleTarget(null)}
      />

      {/* Cancel — custom ConfirmationModal with reason textarea */}
      <dialog className={`modal ${cancelTarget ? 'modal-open' : ''}`}>
        <div className="modal-box w-full max-w-sm rounded-xl bg-white">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-[#E03E3E]" />
            <h3 className="font-bold text-lg text-gray-900">Cancel Appointment</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Cancel <span className="font-semibold">{cancelTarget?.patient_name}</span>'s {cancelTarget?.service_name} request?
          </p>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/30"
            rows={3}
            placeholder="Reason for cancellation (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="modal-action mt-4">
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="border-gray-200 text-gray-600">
              Close
            </Button>
            <Button
              className="bg-[#E03E3E] hover:bg-[#c93535] text-white font-semibold"
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
              isLoading={cancelMutation.isPending}
              loadingText="Cancelling..."
            >
              Cancel Appointment
            </Button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => { setCancelTarget(null); setCancelReason(''); }}>close</button>
        </form>
      </dialog>

      {/* Reschedule */}
      <RescheduleModal
        isOpen={!!rescheduleId}
        appointmentId={rescheduleId}
        onClose={() => setRescheduleId(null)}
      />
    </div>
  );
}
