import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface PaymentGateway {
  id: string;
  provider: string;
  mode: string;
  display_name: string;
  is_active: boolean;
  is_default: boolean;
  client_key: string;
  contract_code: string;
  has_secret_key: boolean;
  secret_key_hint: string;
  config: Record<string, unknown>;
  updated_at: string;
}

export interface GatewayPayload {
  provider?: string;
  mode?: string;
  display_name?: string;
  client_key?: string;
  secret_key?: string;
  contract_code?: string;
  is_active?: boolean;
  is_default?: boolean;
  config?: Record<string, unknown>;
}

export const useAdminGateways = () =>
  useQuery({
    queryKey: ['admin-gateways'],
    queryFn: async () => {
      const res = await apiClient.get('/payments/admin/gateways/');
      return res.data.data as PaymentGateway[];
    },
  });

export const useCreateGateway = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GatewayPayload) => apiClient.post('/payments/admin/gateways/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gateways'] });
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
    },
  });
};

export const useUpdateGateway = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: GatewayPayload & { id: string }) =>
      apiClient.patch(`/payments/admin/gateways/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gateways'] });
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
    },
  });
};

export const useDeleteGateway = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/payments/admin/gateways/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gateways'] });
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
    },
  });
};

// Public — active gateways with client-safe config only (for checkout).
export interface PublicGateway {
  provider: string;
  display_name: string;
  mode: string;
  is_default: boolean;
  public_config: Record<string, unknown>;
}

export const usePaymentGateways = () =>
  useQuery({
    queryKey: ['payment-gateways'],
    queryFn: async () => {
      const res = await apiClient.get('/payments/gateways/');
      return res.data.data as PublicGateway[];
    },
  });
