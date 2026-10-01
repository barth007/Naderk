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

export interface NewPatientPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone_number?: string;
}

/**
 * Register a walk-in patient from the desk.
 *
 * Nothing could create a patient before: CREATABLE_STAFF_ROLES excludes
 * PATIENT and no other path existed, so the dashboard's "New Patient Record"
 * action pointed at a route that does not exist.
 */
export const useCreatePatient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NewPatientPayload) => {
      const res = await apiClient.post('/dashboard/admin/patients/create/', payload);
      return res.data.data as {
        id: string; name: string; email: string;
        patient_id: string; invite_sent: boolean;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-patient-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['patient-records'] });
    },
  });
};

/** Today's report as a PDF. Needs a JWT, so it cannot be a plain <a href>. */
export const adminReportsApi = {
  downloadDailyReport: async () => {
    const res = await apiClient.get('/dashboard/admin/reports/daily/', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export interface AdminArrival {
  id: string;
  patient_name: string;
  service_name: string;
  doctor_name: string | null;
  is_onsite: boolean;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  checked_in_at: string | null;
}

/** Today's expected patients, for the front desk to check in. */
export const useAdminTodayArrivals = () =>
  useQuery({
    queryKey: ['admin-today-arrivals'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/appointments/today/');
      return res.data.data as AdminArrival[];
    },
    refetchInterval: 60_000,
  });

function invalidateArrivals(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-today-arrivals'] });
  qc.invalidateQueries({ queryKey: ['admin-appointment-calendar'] });
  qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
}

export const useCheckInAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiClient.post(`/appointments/${appointmentId}/check-in/`),
    onSuccess: () => invalidateArrivals(queryClient),
  });
};

/** Undo a check-in. Staff only — the API refuses a patient. */
export const useUndoCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiClient.delete(`/appointments/${appointmentId}/check-in/`),
    onSuccess: () => invalidateArrivals(queryClient),
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

export interface AdminPatientOption {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  patient_id: string;
}

/**
 * Patient search for staff booking on someone's behalf.
 *
 * Deliberately not the /medical-records/patients/ list — that one derives its
 * patients from Appointment rows, so a first-time caller would not be findable.
 */
export const useAdminPatientLookup = (query: string) => {
  return useQuery({
    queryKey: ['admin-patient-lookup', query],
    queryFn: async () => {
      const qs = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await apiClient.get(`/dashboard/admin/patients/${qs}`);
      return res.data.data as AdminPatientOption[];
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
