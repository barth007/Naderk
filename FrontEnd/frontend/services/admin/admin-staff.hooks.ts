import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  employee_id: string;
  department: string;
  job_title: string;
  avatar: string | null;
  office_address: string;
  employment_date: string | null;
  status: 'ONLINE' | 'IN_SESSION' | 'OFFLINE';
  is_active: boolean;
}

export interface DaySchedule {
  date: string;
  weekday: string;
  appointment_type: string;
  staff_count: number;
  doctor_ids: string[];
  doctor_names: string[];
  extra_count: number;
}

export interface WeekScheduleSummary {
  total_active: number;
  doctors: number;
  opticians: number;
  others: number;
  on_duty_doctors: number;
  total_doctors: number;
  availability_pct: number;
}

export interface WeekScheduleData {
  week_start: string;
  week_end: string;
  schedule: DaySchedule[];
  summary: WeekScheduleSummary;
}

export const useAdminStaff = () =>
  useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/staff/');
      return res.data.data as StaffMember[];
    },
    refetchInterval: 30_000,
  });

export const useAdminWeekSchedule = () =>
  useQuery({
    queryKey: ['admin-week-schedule'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/staff/schedule/');
      return res.data.data as WeekScheduleData;
    },
    refetchInterval: 60_000,
  });

export const useAdminCreateStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
      role: string;
      department?: string;
      /** Required when role is DOCTOR — see AdminStaffListAPI.post. */
      specialization?: string;
      employee_id?: string;
    }) => apiClient.post('/dashboard/admin/staff/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-week-schedule'] });
    },
  });
};

export const useAdminToggleStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/dashboard/admin/staff/${id}/toggle/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
  });
};

export interface StaffDetail {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  date_joined: string | null;
  last_login: string | null;
  employee_id: string;
  department: string;
  office_address: string;
  employment_date: string | null;
  avatar: string | null;
  doctor: {
    specialization: string;
    specialization_display: string;
    bio: string;
    license_number: string;
    years_experience: number;
    consultation_fee: string | null;
    is_accepting_patients: boolean;
    availability_status: string;
  } | null;
  /** Records tied to this person. Any non-zero count blocks deletion. */
  history: {
    appointments: number;
    telehealth_sessions: number;
    consultations: number;
    prescriptions: number;
    orders: number;
  };
  can_delete: boolean;
}

export interface UpdateStaffInput {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  department?: string;
  office_address?: string;
  employment_date?: string | null;
  specialization?: string;
  bio?: string;
  license_number?: string;
  years_experience?: number;
  consultation_fee?: string | number;
  is_accepting_patients?: boolean;
}

export const useAdminStaffDetail = (id: string) =>
  useQuery({
    queryKey: ['admin-staff', id],
    queryFn: async () => {
      const res = await apiClient.get(`/dashboard/admin/staff/${id}/`);
      return res.data.data as StaffDetail;
    },
    enabled: !!id,
  });

export const useAdminUpdateStaff = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateStaffInput) => apiClient.patch(`/dashboard/admin/staff/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-week-schedule'] });
    },
  });
};

export const useAdminDeleteStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/staff/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-week-schedule'] });
    },
  });
};
