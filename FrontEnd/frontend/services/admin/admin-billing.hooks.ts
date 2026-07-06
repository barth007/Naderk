import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface BillingSummary {
  total_revenue_kobo: number;
  appointment_revenue_kobo: number;
  order_revenue_kobo: number;
  pending_count: number;
  failed_count: number;
  overdue_invoice_amount_kobo: number;
}

export interface Transaction {
  id: string;
  reference: string;
  patient_name: string;
  patient_email: string;
  type: 'APPOINTMENT' | 'ORDER' | 'OTHER';
  service_description: string;
  insurance: string;
  amount_kobo: number;
  currency: string;
  status: 'SUCCESS' | 'INITIATED' | 'FAILED' | 'ABANDONED';
  provider: string;
  created_at: string;
}

export interface TransactionPage {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: Transaction[];
}

export interface BillingFilters {
  type?: 'all' | 'appointment' | 'order';
  status?: string;
  date_from?: string;
  date_to?: string;
}

export const useAdminBillingSummary = (filters: BillingFilters = {}) =>
  useQuery({
    queryKey: ['admin-billing-summary', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to)   params.set('date_to',   filters.date_to);
      const response = await apiClient.get(`/payments/admin/summary/?${params}`);
      return response.data.data as BillingSummary;
    },
    refetchInterval: 60_000,
  });

export const useAdminTransactions = (
  filters: BillingFilters = {},
  page = 1,
  pageSize = 10,
) =>
  useQuery({
    queryKey: ['admin-transactions', filters, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (filters.type && filters.type !== 'all') params.set('type', filters.type);
      if (filters.status)    params.set('status',    filters.status);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to)   params.set('date_to',   filters.date_to);
      const response = await apiClient.get(`/payments/admin/transactions/?${params}`);
      return response.data.data as TransactionPage;
    },
    placeholderData: (prev) => prev,
  });
