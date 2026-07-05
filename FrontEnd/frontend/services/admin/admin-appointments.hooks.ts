import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface AdminAppointmentRequest {
  id: string;
  patient_name: string;
  patient_avatar: string | null;
  service_name: string;
  appointment_type: string;
  is_emergency: boolean;
  preference: string;
  notes: string;
  appointment_date: string | null;
  appointment_time: string | null;
  created_at: string;
  doctor_id: string | null;
  doctor_name: string | null;
}

export interface AdminCalendarAppointment {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  status: string;
}

export interface AdminDoctor {
  id: string;
  name: string;
  specialization: string;
}

export const useAdminAppointmentRequests = () => {
  return useQuery({
    queryKey: ['admin-appointment-requests'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/appointments/requests/');
      return res.data.data as AdminAppointmentRequest[];
    },
    refetchInterval: 30_000,
  });
};

export const useAdminAppointmentCalendar = () => {
  return useQuery({
    queryKey: ['admin-appointment-calendar'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/appointments/calendar/');
      return res.data.data as AdminCalendarAppointment[];
    },
    refetchInterval: 60_000,
  });
};

export interface SchedulePayload {
  appointmentId: string;
  doctor_id: string;
  date: string;
  time: string;
}

export const useAdminScheduleAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, ...body }: SchedulePayload) => {
      const res = await apiClient.post(`/dashboard/admin/appointments/${appointmentId}/schedule/`, body);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-appointment-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });
};

export const useAdminDoctors = () => {
  return useQuery({
    queryKey: ['admin-doctors'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/doctors/');
      return res.data.data as AdminDoctor[];
    },
  });
};

export const useAdminCancelAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason?: string }) => {
      const res = await apiClient.post(`/appointments/${appointmentId}/cancel/`, { reason: reason || '' });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-appointment-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });
};

export const useAdminRescheduleAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, date, time }: { appointmentId: string; date: string; time: string }) => {
      const res = await apiClient.post(`/appointments/${appointmentId}/reschedule/`, { date, time });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointment-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });
};
