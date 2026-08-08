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

/**
 * Every cache a product write can invalidate.
 *
 * Two things were wrong before. First, no product mutation touched the
 * patient-facing marketplace keys, so a new product never appeared to shoppers
 * until its cache aged out. Second, plain invalidateQueries only *refetches*
 * queries that are currently mounted — products are created on
 * /admin/inventory/new, so the table on /admin/inventory is unmounted at that
 * moment and was merely marked stale. `refetchType: 'all'` refetches inactive
 * queries too, so the list is already fresh by the time you land on it.
 */
const invalidateProductCaches = (qc: ReturnType<typeof useQueryClient>) => {
  [
    'admin-products',
    'admin-inventory-summary',
    'marketplace-products',
    'marketplace-products-infinite',
    'marketplace-product',
  ].forEach((key) => qc.invalidateQueries({ queryKey: [key], refetchType: 'all' }));
};

export const useAdminProducts = () =>
  useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/admin/products/');
      return res.data.data as AdminProductsData;
    },
    staleTime: 0,
    refetchOnMount: 'always',
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
      invalidateProductCaches(qc);
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
      invalidateProductCaches(qc);
      qc.invalidateQueries({ queryKey: ['admin-product-detail', vars.id] });
    },
  });
};

export const useAdminDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dashboard/admin/products/${id}/`),
    onSuccess: () => {
      invalidateProductCaches(qc);
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
      invalidateProductCaches(qc);
    },
  });
};

export const useAdminToggleProductStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/dashboard/admin/products/${id}/toggle-status/`),
    onSuccess: () => {
      invalidateProductCaches(qc);
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
