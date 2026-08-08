import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Specialization {
  id: string;
  /** Value stored on doctors and services — this is what booking matches on. */
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  /** Doctors holding this specialization. Zero means no service requiring it
   *  can ever have a specialist assigned. */
  doctor_count: number;
  service_count: number;
  /** doctor_count + service_count — gates removal. */
  in_use: number;
}

const BASE = '/dashboard/specializations/';

/**
 * The single source of specializations for every dropdown in the app — the
 * admin service form, doctor onboarding, and the doctor profile editor. These
 * used to be three hardcoded copies that drifted from the backend enum.
 *
 * Readable by any signed-in user; only admins can write.
 */
export const useSpecializations = (includeInactive = false) =>
  useQuery({
    queryKey: ['specializations', includeInactive],
    queryFn: async () => {
      const res = await apiClient.get(BASE, {
        params: includeInactive ? { include_inactive: 'true' } : undefined,
      });
      return res.data.data as Specialization[];
    },
    staleTime: 5 * 60 * 1000,
  });

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ['specializations'] });

export const useCreateSpecialization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiClient.post(BASE, data);
      return res.data.data as Specialization;
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useUpdateSpecialization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; is_active?: boolean }) => {
      const res = await apiClient.patch(`${BASE}${id}/`, data);
      return res.data.data as Specialization;
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useDeleteSpecialization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => invalidate(qc),
  });
};
