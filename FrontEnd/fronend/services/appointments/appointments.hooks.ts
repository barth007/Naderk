import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api';
import { 
  MedicalService, 
  AssignSpecialistResponse, 
  AvailableSlotsResponse, 
  ReserveSlotResponse,
  AppointmentHistoryResponse,
  Appointment
} from './appointments.types';

export const useMedicalServices = () => {
  return useQuery({
    queryKey: ['medical-services'],
    queryFn: async () => {
      const response = await api.get('/appointments/services/');
      return response.data.data.results as MedicalService[];
    }
  });
};

export const useAssignSpecialist = () => {
  return useMutation({
    mutationFn: async (data: { service_id: string; date: string }) => {
      const response = await api.post('/appointments/assign-specialist/', data);
      return response.data.data as AssignSpecialistResponse;
    }
  });
};

export const useAvailableSlots = (doctorId: string | undefined, date: string | undefined) => {
  return useQuery({
    queryKey: ['available-slots', doctorId, date],
    queryFn: async () => {
      const response = await api.get(`/appointments/available-slots/?doctor_id=${doctorId}&date=${date}`);
      return response.data.data.slots as string[];
    },
    enabled: !!doctorId && !!date
  });
};

export const useReserveSlot = () => {
  return useMutation({
    mutationFn: async (data: { doctor_id: string; date: string; time: string }) => {
      const response = await api.post('/appointments/reserve-slot/', data);
      return response.data.data as ReserveSlotResponse;
    }
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { service_id: string; doctor_id: string; date: string; time: string; appointment_type: string; notes?: string }) => {
      const response = await api.post('/appointments/create/', data);
      return response.data.data as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-appointments'] });
    }
  });
};

export const useAppointmentHistory = (patientId?: string) => {
  return useQuery({
    queryKey: ['appointment-history', patientId],
    queryFn: async () => {
      const url = patientId ? `/appointments/history/?patient_id=${patientId}` : '/appointments/history/';
      const response = await api.get(url);
      return response.data.data as AppointmentHistoryResponse;
    }
  });
};

export const useCancelAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await api.post(`/appointments/${appointmentId}/cancel/`);
      return response.data.data as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-history'] });
    }
  });
};

export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; date: string; time: string }) => {
      const response = await api.post(`/appointments/${data.id}/reschedule/`, {
        date: data.date,
        time: data.time
      });
      return response.data.data as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-history'] });
    }
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await api.delete(`/appointments/${appointmentId}/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-history'] });
    }
  });
};
