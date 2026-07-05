import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface SystemPermission {
  key: string;
  label: string;
  category: string;
}

export interface RolePermissions {
  role: string;
  permissions: string[];
}

export interface PermissionsData {
  system_permissions: SystemPermission[];
  role_permissions: RolePermissions[];
  manageable_roles: string[];
}

export const useAdminPermissions = () =>
  useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/permissions/');
      return res.data.data as PermissionsData;
    },
  });

export const useAdminUpdatePermissions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: string; permissions: string[] }) =>
      apiClient.post('/dashboard/admin/permissions/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-permissions'] }),
  });
};
