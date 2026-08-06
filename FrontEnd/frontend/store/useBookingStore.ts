import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MedicalService, DoctorProfile, AppointmentType } from '@/services/appointments/appointments.types';

/** Local calendar date as YYYY-MM-DD (never UTC — bookings are local-clock). */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface BookingState {
  currentStep: number;
  service: MedicalService | null;
  doctor: DoctorProfile | null;
  date: string | null;
  time: string | null;
  appointmentType: AppointmentType;
  notes: string;
  consultationFee: string;
  isConsultationValid: boolean;
  reservationId: string | null;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  setService: (service: MedicalService) => void;
  setDoctor: (doctor: DoctorProfile | null) => void;
  setDateTime: (date: string, time: string | null) => void;
  setAppointmentDetails: (type: AppointmentType, notes: string) => void;
  setConsultationInfo: (fee: string, isValid: boolean) => void;
  setReservation: (id: string) => void;
  
  resetBooking: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      service: null,
      doctor: null,
      date: null,
      time: null,
      appointmentType: 'PHYSICAL',
      notes: '',
      consultationFee: '0.00',
      isConsultationValid: false,
      reservationId: null,

      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 6) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
      
      // `date` is seeded to today rather than cleared: Step2 assigns a specialist
      // for a given date and Step3 lists that date's slots, so both must read the
      // same value from the moment a service is picked. Leaving it null made Step2
      // silently fall back to its own "today" that Step3 could never change.
      setService: (service) => set({
        service,
        doctor: null,
        date: todayISO(),
        time: null,
        appointmentType: 'PHYSICAL',
        consultationFee: '0.00',
        isConsultationValid: false,
      }),
      setDoctor: (doctor) => set({ doctor }),
      setDateTime: (date, time) => set({ date, time }),
      // Consultation type does NOT affect the recommended doctor (doctor depends on
      // service + date only), so we must not clear the doctor here — doing so left
      // Step2 with a null doctor that never re-fetched.
      setAppointmentDetails: (type, notes) => set({ appointmentType: type, notes }),
      setConsultationInfo: (fee, isValid) => set({ consultationFee: fee, isConsultationValid: isValid }),
      setReservation: (id) => set({ reservationId: id }),
      
      resetBooking: () => set({
        currentStep: 1,
        service: null,
        doctor: null,
        date: null,
        time: null,
        appointmentType: 'PHYSICAL',
        notes: '',
        consultationFee: '0.00',
        isConsultationValid: false,
        reservationId: null,
      }),
    }),
    {
      name: 'naderk-booking-storage-v2',
    }
  )
);
