import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Admin CRUD for the lens catalogue.
 *
 * Distinct from useLensTypes/useLensOptions in marketplace.hooks, which hit the
 * public storefront endpoints and only ever return active rows. These admin
 * endpoints include inactive ones, so a retired lens can be seen and brought
 * back.
 */

export interface AdminLensType {
  id: string;
  name: string;
  description: string;
  price_modifier: string;
  is_active: boolean;
}

export interface AdminLensOption {
  id: string;
  name: string;
  price_modifier: string;
  is_active: boolean;
}

export type LensTypePayload = {
  name: string;
  description?: string;
  price_modifier?: string;
  is_active?: boolean;
};

export type LensOptionPayload = {
  name: string;
  price_modifier?: string;
  is_active?: boolean;
};

const LENS_TYPES_KEY = ['admin-lens-types'];
const LENS_OPTIONS_KEY = ['admin-lens-options'];

/** Storefront caches must drop too, or the builder keeps offering a retired lens. */
function invalidateLenses(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: LENS_TYPES_KEY });
  qc.invalidateQueries({ queryKey: LENS_OPTIONS_KEY });
  qc.invalidateQueries({ queryKey: ['marketplace-lens-types'] });
  qc.invalidateQueries({ queryKey: ['marketplace-lens-options'] });
}

export const useAdminLensTypes = () =>
  useQuery({
    queryKey: LENS_TYPES_KEY,
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/lens-types/');
      return res.data.data as AdminLensType[];
    },
  });

export const useAdminLensOptions = () =>
  useQuery({
    queryKey: LENS_OPTIONS_KEY,
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/lens-options/');
      return res.data.data as AdminLensOption[];
    },
  });

export const useCreateLensType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LensTypePayload) => apiClient.post('/dashboard/admin/lens-types/', data),
    onSuccess: () => invalidateLenses(qc),
  });
};

export const useUpdateLensType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: LensTypePayload & { id: string }) =>
      apiClient.patch(`/dashboard/admin/lens-types/${id}/`, data),
    onSuccess: () => invalidateLenses(qc),
  });
};

export const useDeleteLensType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/lens-types/${id}/`),
    onSuccess: () => invalidateLenses(qc),
  });
};

export const useCreateLensOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LensOptionPayload) => apiClient.post('/dashboard/admin/lens-options/', data),
    onSuccess: () => invalidateLenses(qc),
  });
};

export const useUpdateLensOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: LensOptionPayload & { id: string }) =>
      apiClient.patch(`/dashboard/admin/lens-options/${id}/`, data),
    onSuccess: () => invalidateLenses(qc),
  });
};

export const useDeleteLensOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/lens-options/${id}/`),
    onSuccess: () => invalidateLenses(qc),
  });
};
