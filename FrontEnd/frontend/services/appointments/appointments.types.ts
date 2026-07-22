export type BillingType = 'PER_VISIT' | 'MONTHLY' | 'SESSION_PACK';

export interface MedicalService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  required_specialization: string;
  duration_minutes: number;
  fee: string;
  billing_type: BillingType;
  sessions_included: number | null;
}

export interface DoctorProfile {
  id: string;
  first_name: string;
  last_name: string;
  specialization: string;
  years_experience: number;
  bio: string | null;
  avatar: string | null;
}

export type AppointmentType = 'PHYSICAL' | 'TELEHEALTH' | 'HOME_VISIT' | 'FOLLOW_UP' | 'EMERGENCY';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  service: MedicalService;
  doctor: DoctorProfile;
  appointment_date: string;
  appointment_time: string;
  appointment_type: AppointmentType;
  appointment_type_display: string;
  status: AppointmentStatus;
  status_display: string;
  consultation_fee: string;
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  notes: string | null;
  created_at: string;
  meeting_link: string | null;
  checked_in_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  missed_at: string | null;
  cancelled_at: string | null;
  is_telehealth: boolean;
  is_physical: boolean;
  can_join: boolean;
  telehealth_session_id?: string | null;
}

export interface AssignSpecialistResponse {
  doctor: DoctorProfile;
  consultation_fee: string;
  consultation_valid: boolean;
  estimated_wait_time: string;
}

export interface AvailableSlotsResponse {
  slots: string[];
}

export interface ReserveSlotResponse {
  reservation_id: string;
  expires_at: string;
}

export interface AppointmentHistoryResponse {
  upcoming: Appointment[];
  past: Appointment[];
}
