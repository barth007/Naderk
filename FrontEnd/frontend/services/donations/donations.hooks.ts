import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Extend Life Africa: gifts and volunteer offers from the public page, and the
 * admin screens that review them. Giving needs no account.
 */

export type DonationCurrency = 'NGN' | 'GBP' | 'USD';
export type DonationFrequency = 'ONE_TIME' | 'ANNUAL';

export interface StartDonationPayload {
  donor_name: string;
  donor_email: string;
  currency: DonationCurrency;
  amount: string;
  frequency: DonationFrequency;
  dedicated_to?: string;
  message?: string;
  provider?: string;
}

export interface StartDonationResult {
  donation_id: string;
  reference: string;
  access_code: string;
  public_key: string;
  public_config: Record<string, unknown>;
  provider: string;
  /** Exactly what the payment popup must charge, in kobo / pence / cents. */
  amount_minor: number;
  currency: DonationCurrency;
  email: string;
  donor_name: string;
}

export interface DonationStatus {
  donation_id: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount: string;
  currency: DonationCurrency;
  frequency: DonationFrequency;
  purpose: 'TEST' | 'INTERVENTION' | 'GENERAL';
  next_reminder_on: string | null;
}

export const useStartDonation = (idempotencyKey: string) =>
  useMutation<StartDonationResult, unknown, StartDonationPayload>({
    mutationFn: (payload) =>
      apiClient
        .post('/donations/', payload, { headers: { 'Idempotency-Key': idempotencyKey } })
        .then((r) => r.data.data),
  });

/** Ask the server to check with the provider. Safe to call repeatedly. */
export const verifyDonation = (reference: string) =>
  apiClient.post('/donations/verify/', { reference }).then((r) => r.data.data as DonationStatus);

export type VolunteerRole = 'GP' | 'NURSE' | 'NUTRITIONIST';
export type SessionFormat = '4x15' | '3x20';

export interface VolunteerApplicationPayload {
  full_name: string;
  email: string;
  phone?: string;
  country?: string;
  role: VolunteerRole;
  session_format: SessionFormat;
  registration_number?: string;
  message?: string;
}

export const useVolunteerApply = () =>
  useMutation({
    mutationFn: (payload: VolunteerApplicationPayload) =>
      apiClient.post('/donations/volunteers/', payload).then((r) => r.data.data),
  });

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminDonation {
  id: string;
  donor_name: string;
  donor_email: string;
  currency: DonationCurrency;
  amount: string;
  frequency: DonationFrequency;
  frequency_display: string;
  purpose: string;
  purpose_display: string;
  dedicated_to: string;
  message: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  status_display: string;
  payment_reference: string;
  paid_at: string | null;
  next_reminder_on: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface Paged<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface DonationList extends Paged<AdminDonation> {
  totals: { currency: DonationCurrency; amount: string; count: number }[];
  annual_donors: number;
}

export type VolunteerStatus = 'NEW' | 'CONTACTED' | 'ACCEPTED' | 'DECLINED';

export interface AdminVolunteer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  role: VolunteerRole;
  role_display: string;
  session_format: SessionFormat;
  session_format_display: string;
  registration_number: string;
  message: string;
  status: VolunteerStatus;
  status_display: string;
  staff_notes: string;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface VolunteerList extends Paged<AdminVolunteer> {
  status_counts: Record<VolunteerStatus, number>;
}

type Filters = Record<string, string | number | undefined>;

const clean = (filters: Filters) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));

export const useAdminDonations = (filters: Filters) =>
  useQuery({
    queryKey: ['admin-donations', filters],
    queryFn: () =>
      apiClient.get('/donations/admin/donations/', { params: clean(filters) }).then((r) => r.data.data as DonationList),
    placeholderData: keepPreviousData,
  });

export const useAdminVolunteers = (filters: Filters) =>
  useQuery({
    queryKey: ['admin-volunteers', filters],
    queryFn: () =>
      apiClient.get('/donations/admin/volunteers/', { params: clean(filters) }).then((r) => r.data.data as VolunteerList),
    placeholderData: keepPreviousData,
  });

export const useReviewVolunteer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: VolunteerStatus; staff_notes?: string }) =>
      apiClient.patch(`/donations/admin/volunteers/${id}/`, body).then((r) => r.data.data as AdminVolunteer),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-volunteers'] }),
  });
};
