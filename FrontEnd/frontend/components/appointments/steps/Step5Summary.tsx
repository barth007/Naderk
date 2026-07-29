'use client';

import React, { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useCreateAppointment } from '@/services/appointments/appointments.hooks';
import { useBookingStore } from '@/store/useBookingStore';
import {
  useInitializeAppointmentPayment,
  usePollAppointmentPayment,
  usePaystackPopup,
} from '@/services/payments/payments.hooks';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';

type Phase = 'idle' | 'booking' | 'initializing' | 'popup_open' | 'confirming' | 'cancelling';

export default function Step5Summary() {
  const router = useRouter();
  const {
    service, doctor, date, time, appointmentType, notes,
    consultationFee, isConsultationValid, prevStep, nextStep,
  } = useBookingStore();

  const { user } = useAuth();
  const createAppointmentMutation = useCreateAppointment();
  const idempotencyKey = useRef(`appt-${crypto.randomUUID()}`).current;
  const initPaymentMutation = useInitializeAppointmentPayment(idempotencyKey);
  const openPaystack = usePaystackPopup();

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [pendingAppointmentId, setPendingAppointmentId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const pollQuery = usePollAppointmentPayment(
    phase === 'confirming' ? pendingAppointmentId : null
  );

  // When webhook confirms payment, advance booking flow
  useEffect(() => {
    if (phase === 'confirming' && pollQuery.data?.payment_status === 'PAID') {
      setPhase('idle');
      nextStep();
    }
    if (phase === 'confirming' && pollQuery.data?.payment_status === 'FAILED') {
      setPhase('idle');
      setErrorMsg('Payment failed. Please try again.');
      setPendingAppointmentId(null);
    }
  }, [pollQuery.data?.payment_status, phase]);

  const isFacility = !service?.requires_doctor;

  // Facility services have no doctor; doctor services require one
  if (!service || !date || !time || (!isFacility && !doctor)) return null;

  // For facility services the fee is the service fee itself
  const displayDate = format(parseISO(date), 'EEEE, MMMM do, yyyy');
  const numericFee = isFacility ? parseFloat(service.fee) : parseFloat(consultationFee);
  const requiresPayment = numericFee > 0 && !isConsultationValid;

  const handleConfirm = async () => {
    if (!service || !date || !time) return;
    setErrorMsg(null);

    const doctorId = isFacility ? null : doctor?.id;

    if (!requiresPayment) {
      // Free booking — create appointment directly
      createAppointmentMutation.mutate(
        { service_id: service.id, doctor_id: doctorId, date, time, appointment_type: appointmentType, notes },
        {
          onSuccess: () => nextStep(),
          onError: () => setErrorMsg('Failed to confirm appointment. The slot may have expired.'),
        }
      );
      return;
    }

    // Paid booking — 4-step flow
    try {
      // 1. Create appointment (payment_status=PENDING)
      setPhase('booking');
      const apptData = await new Promise<any>((resolve, reject) => {
        createAppointmentMutation.mutate(
          { service_id: service.id, doctor_id: doctorId, date, time, appointment_type: appointmentType, notes },
          { onSuccess: resolve, onError: reject }
        );
      });
      const appointmentId = apptData?.id;
      if (!appointmentId) throw new Error('No appointment ID returned.');
      setPendingAppointmentId(appointmentId);

      // 2. Initialize Paystack
      setPhase('initializing');
      const payData = await initPaymentMutation.mutateAsync({ appointment_id: appointmentId });

      // 3. Open Paystack popup
      setPhase('popup_open');
      openPaystack({
        publicKey: payData.public_key,
        email: user?.email ?? '',
        amount: numericFee * 100,
        reference: payData.reference,
        accessCode: payData.access_code,
        onSuccess: () => {
          // Webhook is source of truth — start polling
          setPhase('confirming');
        },
        onClose: () => {
          // User closed popup without paying — delete the pending appointment
          setPhase('cancelling');
          apiClient.delete(`/appointments/${appointmentId}/`).finally(() => {
            setPendingAppointmentId(null);
            setPhase('idle');
            setErrorMsg('Payment cancelled. Your slot reservation may have expired.');
          });
        },
      });
    } catch (err: any) {
      setPhase('idle');
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Something went wrong. Please try again.');
    }
  };

  const isProcessing = phase !== 'idle' || createAppointmentMutation.isPending;

  const buttonLabel = () => {
    if (phase === 'booking') return 'Creating appointment…';
    if (phase === 'initializing') return 'Preparing payment…';
    if (phase === 'popup_open') return 'Complete payment in popup…';
    if (phase === 'confirming') return 'Confirming payment…';
    if (phase === 'cancelling') return 'Cancelling…';
    if (createAppointmentMutation.isPending) return 'Processing…';
    return requiresPayment ? `Confirm & Pay ₦${numericFee.toLocaleString('en-NG')}` : 'Confirm Appointment';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">5. Consultation Summary</h2>
        <button onClick={prevStep} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          Back
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">

        {/* Banner based on validity */}
        {isFacility ? (
          <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-start">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <div>
              <h3 className="text-sm font-bold text-amber-800">ON-SITE SERVICE</h3>
              <p className="text-xs text-amber-700 mt-0.5">This service is performed at our facility. No doctor consultation is required.</p>
            </div>
          </div>
        ) : isConsultationValid ? (
          <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex items-start">
            <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <h3 className="text-sm font-bold text-green-800">ACTIVE CONSULTATION</h3>
              <p className="text-xs text-green-700 mt-0.5">Your previous consultation is still valid. No fee is required for this visit.</p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <h3 className="text-sm font-bold text-blue-800">NEW CONSULTATION REQUIRED</h3>
              <p className="text-xs text-blue-700 mt-0.5">A standard consultation fee applies for this specialist visit.</p>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 space-y-8">

          {/* Details */}
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Service</p>
                <p className="font-semibold text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-500">{isFacility ? 'On-Site Facility Visit' : appointmentType === 'PHYSICAL' ? 'In-Person Visit' : 'Telehealth Video Call'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Date & Time</p>
                <p className="font-semibold text-gray-900">{displayDate}</p>
                <p className="text-red-600 font-medium">{time}</p>
              </div>
            </div>

            {isFacility || !doctor ? (
              <div className="flex-1 bg-gray-50 rounded-xl p-5 border border-gray-100 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Location</p>
                  <p className="font-bold text-gray-900">On-Site Facility</p>
                  <p className="text-sm text-gray-500">No doctor required for this service</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-gray-50 rounded-xl p-5 border border-gray-100 flex items-center gap-4">
                {doctor.avatar ? (
                  <img src={doctor.avatar} alt="Doctor" className="w-16 h-16 rounded-full object-cover shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl shadow-sm">
                    {doctor.first_name[0]}{doctor.last_name[0]}
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Specialist</p>
                  <p className="font-bold text-gray-900">Dr. {doctor.first_name} {doctor.last_name}</p>
                  <p className="text-sm text-gray-500">{doctor.specialization.replace('_', ' ')}</p>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Payment breakdown */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Payment Breakdown</h3>
            <div className="bg-gray-50 rounded-xl p-6 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>{isFacility ? 'Service Fee' : 'Consultation Fee'}</span>
                <span className={isConsultationValid ? 'line-through opacity-50' : ''}>
                  ₦{numericFee.toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Taxes & Fees</span>
                <span>₦0.00</span>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total to Pay</span>
                <span className="text-xl font-black text-red-600">
                  ₦{isConsultationValid ? '0.00' : numericFee.toLocaleString('en-NG')}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
              {errorMsg}
            </div>
          )}

          {phase === 'confirming' && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Confirming your payment… this usually takes a few seconds.
            </div>
          )}

          {phase === 'idle' && !isFacility && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm flex items-start">
              <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>Your slot is currently reserved. Please confirm your booking within the next 5 minutes to guarantee this time.</p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center"
          >
            {isProcessing ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />{buttonLabel()}</>
            ) : (
              buttonLabel()
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
