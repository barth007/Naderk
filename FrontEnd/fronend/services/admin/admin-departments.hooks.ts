import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export const useAdminDepartments = () =>
  useQuery({
    queryKey: ['admin-departments'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/departments/');
      return res.data.data as Department[];
    },
  });

export const useAdminCreateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post('/dashboard/admin/departments/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-departments'] }),
  });
};

export const useAdminUpdateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      apiClient.patch(`/dashboard/admin/departments/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-departments'] }),
  });
};

export const useAdminDeleteDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/departments/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-departments'] }),
  });
};
