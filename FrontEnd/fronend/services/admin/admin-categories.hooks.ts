import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  product_count: number;
}

export const useAdminCategories = () =>
  useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/categories/');
      return res.data.data as AdminCategory[];
    },
  });

export const useAdminCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post('/dashboard/admin/categories/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useAdminUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      apiClient.patch(`/dashboard/admin/categories/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useAdminDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/categories/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
