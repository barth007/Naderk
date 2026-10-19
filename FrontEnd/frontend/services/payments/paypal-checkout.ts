'use client';

import { toast } from 'sonner';

/**
 * PayPal checkout for an order the server has already created with PayPal.
 *
 * PayPal has no "open a popup" call like Paystack or Monnify: its buttons have
 * to be rendered somewhere. So this shows a small window holding PayPal's
 * buttons for that order. The buyer approves the payment in PayPal; the server
 * then captures it when asked to verify (never the browser), so onApproved only
 * means "go and confirm".
 */

const SDK_ID = 'paypal-js-sdk';

type PayPalNamespace = {
  Buttons: (opts: Record<string, unknown>) => {
    render: (el: HTMLElement) => Promise<void>;
    close?: () => Promise<void>;
  };
};

function loadSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}`
    + `&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
  const w = window as unknown as { paypal?: PayPalNamespace };
  const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;

  // The SDK is bound to one currency; a gift in £ after one in $ needs a reload.
  if (existing && existing.src === src && w.paypal) return Promise.resolve(w.paypal);
  existing?.remove();
  delete w.paypal;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SDK_ID;
    script.src = src;
    script.async = true;
    script.onload = () => (w.paypal ? resolve(w.paypal) : reject(new Error('PayPal did not load.')));
    script.onerror = () => reject(new Error('PayPal could not be reached.'));
    document.head.appendChild(script);
  });
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amountMinor / 100);
}

export interface PayPalCheckoutOptions {
  clientId: string;
  orderId: string;
  currency: string;
  amountMinor: number;
  description?: string;
  onApproved: () => void;
  onClose: () => void;
}

export function openPayPalCheckout(opts: PayPalCheckoutOptions) {
  if (!opts.clientId || !opts.orderId) {
    toast.error('PayPal is not set up correctly', { description: 'Please choose another payment method.' });
    opts.onClose();
    return;
  }

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Pay with PayPal');
  overlay.className = 'fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4';

  const panel = document.createElement('div');
  panel.className = 'relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-2xl';

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.className = 'absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100';
  close.textContent = '×';

  const title = document.createElement('h2');
  title.className = 'pr-10 text-lg font-bold text-gray-900';
  title.textContent = `Pay ${money(opts.amountMinor, opts.currency)} with PayPal`;

  const note = document.createElement('p');
  note.className = 'mt-1 text-sm text-gray-500';
  note.textContent = opts.description || 'Choose PayPal or a card below to finish your payment.';

  const buttons = document.createElement('div');
  buttons.className = 'mt-5 min-h-[120px]';
  buttons.textContent = 'Loading PayPal…';

  panel.append(close, title, note, buttons);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  const overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let done = false;
  const teardown = () => {
    if (done) return false;
    done = true;
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = overflow;
    overlay.remove();
    return true;
  };
  const dismiss = () => { if (teardown()) opts.onClose(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  document.addEventListener('keydown', onKey);
  close.focus();

  loadSdk(opts.clientId, opts.currency)
    .then((paypal) => {
      if (done) return;
      buttons.textContent = '';
      return paypal.Buttons({
        // The order already exists on the server, priced there.
        createOrder: () => opts.orderId,
        onApprove: async () => { if (teardown()) opts.onApproved(); },
        // The buyer closed PayPal's own window: leave ours open to try again.
        onCancel: () => toast.info('PayPal payment cancelled', { description: 'You can try again or close this window.' }),
        onError: (err: unknown) => {
          console.error('PayPal error', err);
          toast.error('PayPal could not take the payment', { description: 'Please try again or choose another method.' });
        },
      }).render(buttons);
    })
    .catch((err: Error) => {
      buttons.textContent = '';
      toast.error('PayPal is unavailable', { description: err.message });
      dismiss();
    });
}
