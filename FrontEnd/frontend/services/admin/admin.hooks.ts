import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface AdminDashboardStats {
  appointments_today: number;
  appointments_today_change: number;
  active_telehealth: number;
  pending_prescriptions: number;
  optical_revenue_today: number;
  optical_revenue_change: number;
}

export interface AdminAppointmentQueueItem {
  id: string;
  patient_name: string;
  status: string;
  service: string;
  date: string;
  time: string;
  type: string;
}

export interface AdminVolumeTrend {
  month: string;
  count: number;
}

export interface AdminRevenueBreakdown {
  medical_services: number;
  optical_store: number;
  telehealth: number;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  appointment_queue: AdminAppointmentQueueItem[];
  patient_volume_trends: AdminVolumeTrend[];
  revenue_breakdown: AdminRevenueBreakdown;
}

export const useAdminDashboard = () => {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/admin/summary/');
      return response.data.data as AdminDashboardData;
    },
    refetchInterval: 60_000,
  });
};
