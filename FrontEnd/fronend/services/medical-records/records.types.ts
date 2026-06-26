export interface PatientRecord {
  patient_id: string;
  id: string;
  name: string;
  email: string;
  phone_number: string;
  last_visit: string;
  complaints: string[];
  complaints_summary: string;
  mode: 'In-person' | 'Online';
  status: string;
  dob: string;
  gender: string;
  weight: string;
  vitals: string;
  last_appointment: string;
  register_date: string;
  next_appointment: string;
  previous_rx: string;
  current_rx: string;
  address: string;
}

export interface DoctorMinimal {
  id: string;
  first_name: string;
  last_name: string;
  specialization: string;
  avatar: string | null;
}

export interface UserMinimal {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
}

export interface Medication {
  id: string;
  patient: string;
  encounter: string | null;
  prescribed_by: string;
  prescribed_by_name: string;
  name: string;
  dosage: string;
  frequency: string;
  status: 'ACTIVE' | 'COMPLETED';
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface DiagnosticAttachment {
  id: string;
  diagnostic_result: string;
  file: string;
  file_type: 'PDF' | 'IMAGE' | 'OCT_SCAN' | 'LAB_REPORT';
  name: string;
  created_at: string;
}

export interface DiagnosticResult {
  id: string;
  patient: string;
  encounter: string | null;
  test_name: string;
  category: string;
  status: 'READY' | 'PENDING' | 'REVIEW_REQUIRED';
  result_summary: string | null;
  attachments: DiagnosticAttachment[];
  created_at: string;
}

export interface MedicalScan {
  id: string;
  patient: string;
  encounter: string | null;
  scan_type: string;
  image: string;
  captured_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface EyewearPrescription {
  id: string;
  patient: string;
  encounter: string | null;
  right_sph: string | null;
  right_cyl: string | null;
  right_axis: number | null;
  right_add: string | null;
  left_sph: string | null;
  left_cyl: string | null;
  left_axis: number | null;
  left_add: string | null;
  pupillary_distance: string;
  near_pd: string | null;
  segment_height: string | null;
  fitting_height: string | null;
  prescription_file: string | null;
  status: 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REQUIRES_CORRECTION' | 'REJECTED';
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationEncounter {
  id: string;
  patient: string;
  patient_detail: UserMinimal;
  doctor: string;
  doctor_detail: DoctorMinimal;
  appointment: string | null;
  telehealth_session: string | null;
  notes: string | null;
  diagnosis: string | null;
  clinical_findings: string | null;
  reference_number: string;
  recommendations: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationEncounterDetail extends ConsultationEncounter {
  complaints: string | null;
  medications: Medication[];
  diagnostics: DiagnosticResult[];
  scans: MedicalScan[];
  eyewear_prescriptions: EyewearPrescription[];
}

export interface PatientInfo {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  dob: string | null;
  gender: string;
  patient_id: string;
  address: string;
}

export interface MedicalRecordsOverview {
  patient_info: PatientInfo;
  recent_encounters: ConsultationEncounter[];
  active_medications: Medication[];
  recent_diagnostics: DiagnosticResult[];
  recent_scans: MedicalScan[];
  eyewear_prescriptions: EyewearPrescription[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
