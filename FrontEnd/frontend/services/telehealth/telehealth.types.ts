export type TelehealthSessionStatus =
  | 'SCHEDULED'
  | 'WAITING_ROOM'
  | 'WAITING_FOR_DOCTOR'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PATIENT_NO_SHOW'
  | 'DOCTOR_NO_SHOW'
  | 'MISSED';

export interface UserMinimal {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'PATIENT' | 'DOCTOR' | 'AGENT' | 'ADMIN' | 'VOLUNTEER' | 'DONOR';
  hospital_id: string | null;
}

export interface TelehealthParticipant {
  id: string;
  user: UserMinimal;
  role: 'PATIENT' | 'DOCTOR';
  joined_at: string | null;
  left_at: string | null;
  connection_status: 'CONNECTED' | 'DISCONNECTED';
}

export interface TelehealthEvent {
  id: string;
  event_type: string;
  actor: UserMinimal | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface TelehealthSession {
  id: string;
  appointment_id: string;
  patient: UserMinimal;
  doctor: UserMinimal;
  service_name: string;
  room_name: string;
  room_id: string | null;
  status: TelehealthSessionStatus;
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  conversation_id: string | null;
  session_notes: string;
  participants: TelehealthParticipant[];
  events: TelehealthEvent[];
  created_at: string;
  updated_at: string;
}

export interface TelehealthCredentials {
  room_name: string;
  token: string;
  server_url: string;
}

export interface SessionsListResponse {
  active: TelehealthSession[];
  upcoming: TelehealthSession[];
  past: TelehealthSession[];
}
