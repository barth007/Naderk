'use client';

import { useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Order } from '@/services/marketplace/marketplace.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InitializePaymentPayload {
  amount_kobo: number;
  email: string;
  shipping_address: string;
  provider?: string;
}

export interface InitializePaymentResult {
  reference: string;
  authorization_url: string;
  access_code: string;
  public_key: string;
  provider: string;
  order_id: string;   // poll this until payment_status = PAID
}

export interface PaystackPopupOptions {
  publicKey: string;
  email: string;
  amount: number;       // in kobo
  reference: string;
  accessCode?: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Initialize a payment session. Creates an unpaid order on the backend and
 * returns provider credentials needed to open the payment popup.
 */
/**
 * Generates a stable idempotency key for the lifetime of this hook instance
 * (i.e. one checkout session). If the user retries the same payment attempt,
 * the backend returns the same order/credentials instead of creating a new order.
 */
export function useCheckoutIdempotencyKey() {
  const key = useRef(`checkout-${crypto.randomUUID()}`);
  return key.current;
}

export function useInitializePayment(idempotencyKey: string) {
  return useMutation<InitializePaymentResult, Error, InitializePaymentPayload>({
    mutationFn: (payload) =>
      apiClient
        .post('/payments/initialize/', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        })
        .then((r: any) => r.data?.data ?? r.data),
  });
}

/**
 * Poll a specific order until payment_status === 'PAID' (or max retries hit).
 * Automatically stops refetching once payment is confirmed.
 */
export function usePollOrderPayment(orderId: string | null) {
  return useQuery<Order>({
    queryKey: ['order-payment-poll', orderId],
    queryFn: () =>
      apiClient
        .get(`/marketplace/orders/${orderId}/`)
        .then((r: any) => r.data?.data ?? r.data),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling once paid or cancelled
      if (data?.payment_status === 'PAID' || data?.payment_status === 'FAILED') return false;
      return 3000; // poll every 3 seconds
    },
    refetchIntervalInBackground: true,
  });
}

// ── Appointment payment hooks ──────────────────────────────────────────────────

export interface InitializeAppointmentPaymentPayload {
  appointment_id: string;
  provider?: string;
}

export interface InitializeAppointmentPaymentResult {
  reference: string;
  authorization_url: string;
  access_code: string;
  public_key: string;
  provider: string;
  appointment_id: string;
}

export function useInitializeAppointmentPayment(idempotencyKey: string) {
  return useMutation<InitializeAppointmentPaymentResult, Error, InitializeAppointmentPaymentPayload>({
    mutationFn: (payload) =>
      apiClient
        .post('/payments/initialize-appointment/', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        })
        .then((r: any) => r.data?.data ?? r.data),
  });
}

export function usePollAppointmentPayment(appointmentId: string | null) {
  return useQuery<any>({
    queryKey: ['appointment-payment-poll', appointmentId],
    queryFn: () =>
      apiClient
        .get(`/appointments/${appointmentId}/`)
        .then((r: any) => r.data?.data ?? r.data),
    enabled: !!appointmentId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.payment_status === 'PAID' || data?.payment_status === 'FAILED') return false;
      return 3000;
    },
    refetchIntervalInBackground: true,
  });
}

/**
 * Returns a stable function that opens the Paystack inline popup.
 * Requires the Paystack inline script loaded in layout.tsx.
 */
export function usePaystackPopup() {
  return useCallback((opts: PaystackPopupOptions) => {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      console.error('Paystack inline script not loaded.');
      opts.onClose();
      return;
    }

    const handler = PaystackPop.setup({
      key: opts.publicKey,
      email: opts.email,
      amount: opts.amount,
      ref: opts.reference,
      ...(opts.accessCode ? { access_code: opts.accessCode } : {}),
      callback: (response: { reference: string }) => opts.onSuccess(response.reference),
      onClose: opts.onClose,
    });

    handler.openIframe();
  }, []);
}
