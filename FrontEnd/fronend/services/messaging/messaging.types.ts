export type UserRole = 'PATIENT' | 'AGENT' | 'DOCTOR' | 'ADMIN' | 'VOLUNTEER' | 'DONOR';

export interface UserMinimal {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  patient_id?: string;
  avatar?: string | null;
  dob?: string;
  gender?: string;
  phone_number?: string;
}

export type ConversationStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_PATIENT' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';

export type ConversationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type MessagingCategory = 'APPOINTMENT' | 'CONSULTATION' | 'PRESCRIPTION' | 'BILLING' | 'TELEHEALTH' | 'MEDICAL_RECORDS' | 'INSURANCE' | 'OTHER';

export type MessagingDepartment = 'GENERAL' | 'APPOINTMENTS' | 'OPHTHALMOLOGY' | 'OPTOMETRY' | 'BILLING' | 'TELEHEALTH' | 'MEDICAL_RECORDS' | 'INSURANCE';

export interface Message {
  id: string;
  conversation: string;
  sender: UserMinimal;
  content: string;
  attachment_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  patient: UserMinimal;
  assigned_agent?: UserMinimal;
  assigned_doctor?: UserMinimal;
  department: MessagingDepartment;
  category: MessagingCategory;
  priority: ConversationPriority;
  subject?: string;
  status: ConversationStatus;
  first_response_at?: string;
  resolved_at?: string;
  is_archived: boolean;
  related_appointment?: string;
  related_telehealth_session?: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  unread_count: number;
  last_message?: {
    id: string;
    content: string;
    sender_id: string;
    sender_role: UserRole;
    created_at: string;
  };
}

export interface InternalNote {
  id: string;
  conversation: string;
  author: UserMinimal;
  content: string;
  created_at: string;
}

export interface ConversationActivity {
  id: string;
  conversation: string;
  actor?: UserMinimal;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  conversation?: string;
  created_at: string;
}
