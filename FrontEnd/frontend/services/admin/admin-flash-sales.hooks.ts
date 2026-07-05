import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface FlashSaleProduct {
  id: string;
  name: string;
  original_price: string;
  discounted_price: string;
  images: string[];
}

export interface FlashSale {
  id: string;
  name: string;
  discount_percent: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_live: boolean;
  product_count: number;
  product_ids: string[];
}

export interface ActiveFlashSale {
  id: string;
  name: string;
  discount_percent: string;
  ends_at: string;
  products: FlashSaleProduct[];
}

export const useAdminFlashSales = () =>
  useQuery({
    queryKey: ['admin-flash-sales'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/flash-sales/');
      return res.data.data as FlashSale[];
    },
  });

export const useActiveFlashSale = () =>
  useQuery({
    queryKey: ['active-flash-sale'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/flash-sales/active/');
      return res.data.data as ActiveFlashSale | null;
    },
    refetchInterval: 60_000,
  });

export const useAdminCreateFlashSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      discount_percent: number;
      starts_at: string;
      ends_at: string;
      product_ids: string[];
    }) => apiClient.post('/dashboard/admin/flash-sales/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flash-sales'] });
      qc.invalidateQueries({ queryKey: ['active-flash-sale'] });
    },
  });
};

export const useAdminUpdateFlashSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiClient.patch(`/dashboard/admin/flash-sales/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flash-sales'] });
      qc.invalidateQueries({ queryKey: ['active-flash-sale'] });
    },
  });
};

export const useAdminDeleteFlashSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/flash-sales/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flash-sales'] });
      qc.invalidateQueries({ queryKey: ['active-flash-sale'] });
    },
  });
};
