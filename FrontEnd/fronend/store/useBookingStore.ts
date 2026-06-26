import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MedicalService, DoctorProfile, AppointmentType } from '@/services/appointments/appointments.types';

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
  setDoctor: (doctor: DoctorProfile) => void;
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
      
      setService: (service) => set({ service }),
      setDoctor: (doctor) => set({ doctor }),
      setDateTime: (date, time) => set({ date, time }),
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
