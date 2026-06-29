import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface InventoryCategoryBreakdown {
  category__name: string;
  total: number;
}

export interface LowStockAlert {
  id: string;
  name: string;
  quantity_available: number;
  category__name: string;
}

export interface AdminInventorySummary {
  total_stock: number;
  category_count: number;
  by_category: InventoryCategoryBreakdown[];
  low_stock_alerts: LowStockAlert[];
}

export interface AdminOrder {
  id: string;
  customer_name: string;
  status: string;
  total_price: string;
  created_at: string;
  first_item_name: string;
  first_item_image: string | null;
  first_item_qty: number;
}

export const useAdminInventorySummary = () =>
  useQuery({
    queryKey: ['admin-inventory-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/inventory/summary/');
      return res.data.data as AdminInventorySummary;
    },
    refetchInterval: 60_000,
  });

export interface AdminProduct {
  id: string;
  name: string;
  category_name: string;
  quantity_available: number;
  price: string;
  units_sold: number;
  units_sold_today: number;
  revenue: number;
  sparkline: number[];
  low_stock: boolean;
  is_active: boolean;
}

export interface StockHistoryItem {
  type: 'SOLD' | 'RESTOCK';
  quantity: number;
  customer: string;
  order_id: string;
  date: string;
}

export interface AdminProductsSummary {
  total_products: number;
  total_units_sold_today: number;
  total_stock_remaining: number;
}

export interface AdminProductsData {
  products: AdminProduct[];
  summary: AdminProductsSummary;
}

export const useAdminProducts = () =>
  useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/products/');
      return res.data.data as AdminProductsData;
    },
    refetchInterval: 60_000,
  });

export const useAdminCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.post('/dashboard/admin/products/create/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-inventory-summary'] });
    },
  });
};

export interface AdminProductDetail {
  id: string;
  name: string;
  description: string;
  category_id: string;
  category_name: string;
  price: string;
  quantity_available: number;
  low_stock_threshold: number;
  is_active: boolean;
  images: string[];
  slug: string;
  variants: {
    id: string;
    variant_name: string;
    sku: string;
    price_modifier: string;
    quantity_available: number;
    low_stock_threshold: number;
    is_active: boolean;
  }[];
}

export const useAdminProductDetail = (productId: string | null) =>
  useQuery({
    queryKey: ['admin-product-detail', productId],
    queryFn: async () => {
      const res = await apiClient.get(`/dashboard/admin/products/${productId}/`);
      return res.data.data as AdminProductDetail;
    },
    enabled: !!productId,
  });

export const useAdminUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiClient.patch(`/dashboard/admin/products/${id}/`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product-detail', vars.id] });
    },
  });
};

export const useAdminDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/products/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-inventory-summary'] });
    },
  });
};

export const useAdminProductHistory = (productId: string | null) =>
  useQuery({
    queryKey: ['admin-product-history', productId],
    queryFn: async () => {
      const res = await apiClient.get(`/dashboard/admin/products/${productId}/history/`);
      return res.data.data as StockHistoryItem[];
    },
    enabled: !!productId,
  });

export const useAdminRestockProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiClient.post(`/dashboard/admin/products/${id}/restock/`, { quantity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-inventory-summary'] });
    },
  });
};

export const useAdminToggleProductStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/dashboard/admin/products/${id}/toggle-status/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
};

export const useAdminAllOrders = (status?: string) =>
  useQuery({
    queryKey: ['admin-orders', status],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/orders/', {
        params: status ? { status } : undefined,
      });
      return res.data.data as AdminOrder[];
    },
    refetchInterval: 30_000,
  });
