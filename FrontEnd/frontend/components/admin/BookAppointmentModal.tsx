'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, Check, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/DatePicker';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import {
  useAdminPatientLookup,
  useAdminDoctors,
  AdminPatientOption,
} from '@/services/admin/admin-appointments.hooks';
import {
  useMedicalServices,
  useAvailableSlots,
  useCreateAppointment,
} from '@/services/appointments/appointments.hooks';

/**
 * Staff booking on a patient's behalf, from the /admin appointments desk.
 *
 * The admin page could only schedule appointment *requests* a patient had
 * already submitted. A support agent taking a booking over chat had nowhere to
 * create one, so this was only ever possible from the patient's own portal.
 */
export default function BookAppointmentModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [patientQuery, setPatientQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [patient, setPatient] = useState<AdminPatientOption | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('PHYSICAL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(patientQuery), 300);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const { data: patients = [], isLoading: loadingPatients } = useAdminPatientLookup(debouncedQuery);
  const { data: services = [] } = useMedicalServices();
  const { data: doctors = [] } = useAdminDoctors();
  const createAppointment = useCreateAppointment();

  const service = useMemo(() => services.find(s => s.id === serviceId), [services, serviceId]);
  const needsDoctor = !!service?.requires_doctor;

  // Facility services have no doctor, so slots are queried by service instead.
  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    needsDoctor ? doctorId || undefined : undefined,
    date || undefined,
    serviceId || undefined,
  );

  // A service that isn't offered online can't be a telehealth booking. Derived
  // rather than synced back into state, so selecting such a service can't cause
  // a render cascade — and switching away restores the earlier choice.
  const effectiveType =
    service && !service.available_online && appointmentType === 'TELEHEALTH'
      ? 'PHYSICAL'
      : appointmentType;

  // Anything the slot list depends on invalidates the chosen slot; cleared in
  // the change handlers below rather than in an effect.

  function reset() {
    setPatientQuery(''); setDebouncedQuery(''); setPatient(null);
    setServiceId(''); setDoctorId(''); setDate(''); setTime('');
    setAppointmentType('PHYSICAL'); setNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  const canSubmit =
    !!patient && !!serviceId && !!date && !!time && (!needsDoctor || !!doctorId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) { toast.error('Select a patient first.'); return; }
    if (!serviceId) { toast.error('Select a service.'); return; }
    if (needsDoctor && !doctorId) { toast.error('This service needs a doctor.'); return; }
    if (!date || !time) { toast.error('Pick a date and time.'); return; }

    try {
      await createAppointment.mutateAsync({
        patient_id: patient.id,
        service_id: serviceId,
        doctor_id: needsDoctor ? doctorId : null,
        date,
        time,
        appointment_type: effectiveType,
        notes: notes.trim(),
      });
      toast.success(`Appointment booked for ${patient.name}.`);
      handleClose();
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data;
      toast.error(detail?.detail || detail?.message || 'Failed to book the appointment.');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <CalendarPlus className="w-5 h-5 text-[#E03E3E]" />
            <div>
              <h3 className="font-bold text-lg text-gray-900 leading-tight">Book Appointment</h3>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">On behalf of a patient</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close"
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
          {/* Patient */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Patient</label>
            {patient ? (
              <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50/50">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{patient.name}</p>
                  <p className="text-xs text-gray-400 font-semibold truncate">
                    {patient.email} · {patient.patient_id}
                  </p>
                </div>
                <button type="button" onClick={() => setPatient(null)}
                  className="text-xs font-bold text-[#E03E3E] hover:underline shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    placeholder="Search by name, email, phone or patient ID"
                    className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg pl-9 pr-3 py-2.5 text-xs font-semibold text-gray-700 outline-none"
                  />
                </div>
                <div className="border border-gray-100 rounded-lg max-h-44 overflow-y-auto divide-y divide-gray-50">
                  {loadingPatients ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="w-4 h-4 text-[#E03E3E] animate-spin" />
                    </div>
                  ) : patients.length === 0 ? (
                    <p className="text-xs text-gray-400 font-semibold p-3 text-center">
                      No patients match that search.
                    </p>
                  ) : (
                    patients.map(p => (
                      <button type="button" key={p.id} onClick={() => setPatient(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors">
                        <p className="text-xs font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 font-semibold truncate">
                          {p.email} · {p.patient_id}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Service</label>
            <select value={serviceId} onChange={e => { setServiceId(e.target.value); setDoctorId(''); setTime(''); }}
              className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg p-2.5 text-xs font-semibold text-gray-700 outline-none">
              <option value="">Select a service…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['PHYSICAL', 'TELEHEALTH'] as const).map(t => {
                const disabled = t === 'TELEHEALTH' && !!service && !service.available_online;
                return (
                  <button type="button" key={t} disabled={disabled}
                    onClick={() => setAppointmentType(t)}
                    title={disabled ? 'This service is not available online' : undefined}
                    className={cn(
                      'py-2.5 rounded-lg text-xs font-bold border transition-colors',
                      effectiveType === t
                        ? 'bg-[#E03E3E] text-white border-[#E03E3E]'
                        : 'bg-gray-50/50 text-gray-600 border-gray-200 hover:bg-gray-100',
                      disabled && 'opacity-40 cursor-not-allowed hover:bg-gray-50/50',
                    )}>
                    {t === 'PHYSICAL' ? 'In person' : 'Telehealth'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Doctor */}
          {needsDoctor && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Doctor</label>
              <select value={doctorId} onChange={e => { setDoctorId(e.target.value); setTime(''); }}
                className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg p-2.5 text-xs font-semibold text-gray-700 outline-none">
                <option value="">Select a doctor…</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
              </select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Date</label>
            <DatePicker value={date} onChange={(v) => { setDate(v); setTime(''); }} />
          </div>

          {/* Slots */}
          {date && (needsDoctor ? doctorId : serviceId) && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Time</label>
              {loadingSlots ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="w-4 h-4 text-[#E03E3E] animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-xs text-gray-400 font-semibold py-2">
                  No slots available on that date.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                  {slots.map(s => (
                    <button type="button" key={s} onClick={() => setTime(s)}
                      className={cn(
                        'py-1.5 rounded-md text-[11px] font-bold border transition-colors flex items-center justify-center gap-1',
                        time === s
                          ? 'bg-[#E03E3E] text-white border-[#E03E3E]'
                          : 'bg-gray-50/50 text-gray-600 border-gray-200 hover:bg-gray-100',
                      )}>
                      {time === s && <Check className="w-3 h-3" />}{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Reason for the visit, or context from the conversation"
              className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg p-2.5 text-xs font-semibold text-gray-700 outline-none resize-none" />
          </div>
        </form>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={handleClose} className="border-gray-200 text-gray-600 h-10 text-xs font-bold rounded-lg">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} isLoading={createAppointment.isPending}
            className="bg-[#E03E3E] text-white h-10 text-xs font-bold rounded-lg">
            Book Appointment
          </Button>
        </div>
      </div>
    </div>
  );
}
