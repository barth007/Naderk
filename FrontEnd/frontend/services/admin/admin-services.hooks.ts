import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type BillingType = 'PER_VISIT' | 'MONTHLY' | 'SESSION_PACK';

export const BILLING_LABELS: Record<BillingType, string> = {
  PER_VISIT:    'Per Visit',
  MONTHLY:      'Monthly (unlimited)',
  SESSION_PACK: 'Session Pack',
};

export interface AdminService {
  id: string;
  name: string;
  slug: string;
  description: string;
  required_specialization: string;
  duration_minutes: number;
  buffer_time_before: number;
  buffer_time_after: number;
  fee: string;
  billing_type: BillingType;
  sessions_included: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateServicePayload {
  name: string;
  description?: string;
  required_specialization: string;
  duration_minutes?: number;
  buffer_time_before?: number;
  buffer_time_after?: number;
  fee: string;
  billing_type: BillingType;
  sessions_included?: number;
  is_active?: boolean;
}

const BASE = '/dashboard/admin/services/';

export const useAdminServices = () =>
  useQuery({
    queryKey: ['admin-services'],
    queryFn: async () => {
      const res = await apiClient.get(BASE);
      return res.data.data as AdminService[];
    },
  });

export const useAdminCreateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServicePayload) => apiClient.post(BASE, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-services'] }),
  });
};

export const useAdminUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateServicePayload> & { id: string }) =>
      apiClient.patch(`${BASE}${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-services'] }),
  });
};

export const useAdminToggleService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch(`${BASE}${id}/`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-services'] }),
  });
};

export const useAdminDeleteService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-services'] }),
  });
};
