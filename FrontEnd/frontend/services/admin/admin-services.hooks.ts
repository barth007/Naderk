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
  requires_doctor: boolean;
  available_online: boolean;
  required_specialization: string | null;
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
  requires_doctor: boolean;
  available_online?: boolean;
  required_specialization?: string;
  duration_minutes?: number;
  buffer_time_before?: number;
  buffer_time_after?: number;
  fee: string;
  billing_type: BillingType;
  sessions_included?: number;
  is_active?: boolean;
}

const BASE = '/dashboard/admin/services/';

// Activating/deactivating a service changes what patients see in the booking
// wizard, so every write here must also drop the patient-facing services cache.
const invalidateServiceCaches = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin-services'] });
  qc.invalidateQueries({ queryKey: ['medical-services'] });
};

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
    onSuccess: () => invalidateServiceCaches(qc),
  });
};

export const useAdminUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateServicePayload> & { id: string }) =>
      apiClient.patch(`${BASE}${id}/`, data),
    onSuccess: () => invalidateServiceCaches(qc),
  });
};

export const useAdminToggleService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await apiClient.patch(`${BASE}${id}/`, { is_active });
      return res.data.data as AdminService;
    },
    // Write the server's row straight into the list so the card (and its
    // Activate/Deactivate label) flips as soon as the request returns.
    //
    // Deliberately NOT invalidating ['admin-services'] here: the PATCH response
    // is the authoritative row, so a refetch only re-renders the whole grid a
    // second time, which reads as a flicker. Only the patient-facing list needs
    // dropping, since activation changes what patients can book.
    onSuccess: (updated) => {
      qc.setQueryData<AdminService[]>(['admin-services'], (prev) =>
        prev?.map((s) => (s.id === updated.id ? updated : s)),
      );
      qc.invalidateQueries({ queryKey: ['medical-services'] });
    },
  });
};

export const useAdminDeleteService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => invalidateServiceCaches(qc),
  });
};
