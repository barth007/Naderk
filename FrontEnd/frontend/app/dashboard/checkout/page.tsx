'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, CreditCard, Package, Glasses,
  CheckCircle2, Loader2, ShieldCheck, Info, Truck,
} from 'lucide-react';
import { Country, State } from 'country-state-city';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { toast } from 'sonner';
import { useCart } from '@/services/marketplace/marketplace.hooks';
import {
  useInitializePayment, usePollOrderPayment,
  usePaystackPopup, useCheckoutIdempotencyKey,
} from '@/services/payments/payments.hooks';
import { CartItem } from '@/services/marketplace/marketplace.types';
import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemLabel(item: CartItem): string {
  if (item.frame_variant_detail && item.frame_detail)
    return `${item.frame_detail.brand} ${item.frame_detail.name} — ${item.frame_variant_detail.color}`;
  if (item.product_detail) return item.product_detail.name;
  return 'Item';
}
function itemImage(item: CartItem): string | undefined {
  if (item.frame_detail?.front_image) return item.frame_detail.front_image;
  if (item.product_detail?.images?.[0]) return item.product_detail.images[0];
  return undefined;
}

// ── Delivery address modal (only shown if profile has no delivery address) ────

function DeliveryAddressModal({ onSaved }: {
  onSaved: (data: { street: string; city: string; state: string; country: string }) => void;
}) {
  const [street, setStreet]   = useState('');
  const [city, setCity]       = useState('');
  const [state, setState]     = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving]   = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states    = useMemo(() => country ? State.getStatesOfCountry(country) : [], [country]);

  const handleSave = async () => {
    if (!street.trim() || !city.trim() || !country) {
      toast.error('Street, city and country are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put('/users/profile/', {
        delivery_street: street.trim(),
        delivery_city: city.trim(),
        delivery_state: state,
        delivery_country: country,
      });
      toast.success('Delivery address saved!');
      onSaved({ street: street.trim(), city: city.trim(), state, country });
    } catch {
      toast.error('Failed to save address. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fee2e2] flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-[#E03E3E]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Delivery Address Required</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              This is saved to your profile — you won't be asked again.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Street Address *</label>
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} autoFocus
              placeholder="e.g. 14 Lugbe Road, Opposite Zenith Bank"
              className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2.5 text-xs text-gray-900" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Country *</label>
              <select value={country} onChange={e => { setCountry(e.target.value); setState(''); }}
                className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2.5 text-xs text-gray-900 bg-white">
                <option value="">Select country…</option>
                {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">State / Province</label>
              <select value={state} onChange={e => setState(e.target.value)}
                disabled={!country || states.length === 0}
                className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2.5 text-xs text-gray-900 bg-white disabled:opacity-50">
                <option value="">Select state…</option>
                {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">City *</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="e.g. Abuja"
              className="w-full border border-gray-200 focus:outline-none focus:border-[#E03E3E] rounded-md px-3 py-2.5 text-xs text-gray-900" />
          </div>

          <p className="text-[10px] text-gray-400">
            Saved to your profile. You can update it anytime from your Profile page.
          </p>
        </div>

        <Button className="w-full bg-[#E03E3E] hover:bg-[#c93636] text-white font-bold rounded-md"
          onClick={handleSave} disabled={saving || !street.trim() || !city.trim() || !country}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}

// ── Payment phases ────────────────────────────────────────────────────────────

type PaymentPhase = 'idle' | 'initializing' | 'popup_open' | 'waiting_webhook';

// ── Checkout page ─────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart();

  const idempotencyKey    = useCheckoutIdempotencyKey();
  const initializePayment = useInitializePayment(idempotencyKey);
  const openPaystack      = usePaystackPopup();

  const [profileLoading, setProfileLoading]     = useState(true);
  const [showAddressModal, setShowAddressModal]  = useState(false);
  const [paymentPhase, setPaymentPhase]          = useState<PaymentPhase>('idle');
  const [pendingOrderId, setPendingOrderId]      = useState<string | null>(null);

  // Shipping address fields (pre-populated from profile)
  const [street, setStreet]   = useState('');
  const [city, setCity]       = useState('');
  const [state, setState]     = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone]     = useState('');

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states    = useMemo(() => country ? State.getStatesOfCountry(country) : [], [country]);

  // ── Load profile once, pre-populate, show modal only if no delivery address ──
  useEffect(() => {
    let cancelled = false;
    apiClient.get('/users/profile/').then((res: any) => {
      if (cancelled) return;
      const p = res.data?.data ?? res.data ?? res;
      const hasDelivery = p.delivery_street && p.delivery_city && p.delivery_country;
      if (!hasDelivery) {
        setShowAddressModal(true);
      } else {
        setStreet(p.delivery_street || '');
        setCity(p.delivery_city || '');
        setState(p.delivery_state || '');
        setCountry(p.delivery_country || '');
      }
      if (p.phone_number) setPhone(p.phone_number);
    }).catch(() => {
      setShowAddressModal(true);
    }).finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Poll order after popup closes ─────────────────────────────────────────
  const { data: polledOrder } = usePollOrderPayment(pendingOrderId);

  useEffect(() => {
    if (!polledOrder) return;
    if (polledOrder.payment_status === 'PAID') {
      const underReview = polledOrder.status === 'PRESCRIPTION_REVIEW';
      toast.success(underReview
        ? 'Payment confirmed! Your prescription is under review.'
        : 'Payment confirmed! Your order has been placed.');
      router.push(`/dashboard/orders?new=${polledOrder.id}`);
    } else if (polledOrder.payment_status === 'FAILED') {
      toast.error('Payment failed. Please try again.');
      setPendingOrderId(null);
      setPaymentPhase('idle');
    }
  }, [polledOrder, router]);

  const countryName = country ? Country.getCountryByCode(country)?.name ?? country : '';
  const stateName   = (state && country)
    ? State.getStatesOfCountry(country).find(s => s.isoCode === state)?.name ?? state
    : '';
  const shippingAddress = [street, city, stateName, countryName].filter(Boolean).join(', ');

  const items     = cart?.items ?? [];
  const total     = cart?.total_price ?? 0;
  const amtKobo   = Math.round(Number(total) * 100);
  const canPay    = !!street.trim() && !!city.trim() && !!country && paymentPhase === 'idle';

  const handlePay = async () => {
    if (!canPay) { toast.error('Please fill in your shipping address.'); return; }
    setPaymentPhase('initializing');

    let creds;
    try {
      creds = await initializePayment.mutateAsync({
        amount_kobo: amtKobo,
        email: user?.email ?? '',
        shipping_address: shippingAddress,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Could not initialize payment. Please try again.');
      setPaymentPhase('idle');
      return;
    }

    setPendingOrderId(creds.order_id);
    setPaymentPhase('popup_open');

    openPaystack({
      publicKey:  creds.public_key,
      email:      user?.email ?? '',
      amount:     amtKobo,
      reference:  creds.reference,
      accessCode: creds.access_code,
      onSuccess: () => {
        setPaymentPhase('waiting_webhook');
        toast.info('Payment submitted! Confirming your order…');
      },
      onClose: () => {
        setPendingOrderId(null);
        setPaymentPhase('idle');
        toast.info('Payment cancelled. Your cart is still intact.');
      },
    });
  };

  // ── Loading states ────────────────────────────────────────────────────────

  if (isLoading || profileLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#ff052f] animate-spin" />
        <p className="text-sm text-gray-400 font-semibold">Loading…</p>
      </div>
    );
  }

  if (items.length === 0 && paymentPhase === 'idle') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center p-8">
        <Package className="w-12 h-12 text-gray-200" />
        <p className="font-bold text-gray-700">Your cart is empty.</p>
        <Button onClick={() => router.push('/dashboard/marketplace')}
          className="rounded-md bg-[#ff052f] hover:bg-[#d90022] text-white">
          Browse Marketplace
        </Button>
      </div>
    );
  }

  if (paymentPhase === 'waiting_webhook') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-[#ff052f] animate-spin" />
        <p className="text-base font-extrabold text-gray-900">Confirming your payment…</p>
        <p className="text-sm text-gray-400 font-semibold max-w-xs text-center">
          Please wait while we verify your payment. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  const payLabel = {
    idle:         `Pay ₦${Number(total).toLocaleString()} with Paystack`,
    initializing: 'Preparing payment…',
    popup_open:   'Complete payment in popup…',
    waiting_webhook: 'Confirming…',
  }[paymentPhase];

  return (
    <>
      {showAddressModal && (
        <DeliveryAddressModal
          onSaved={({ street: s, city: c, state: st, country: co }) => {
            setStreet(s); setCity(c); setState(st); setCountry(co);
            setShowAddressModal(false);
          }}
        />
      )}

      <div className={cn("w-full max-w-5xl mx-auto pb-20 animate-in fade-in duration-300",
        showAddressModal && "pointer-events-none select-none")}>

        <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6"><Breadcrumbs /></div>

        <div className="flex items-center gap-3 mb-8">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/cart')}
            className="rounded-full w-9 h-9 border-gray-200 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Checkout</h1>
            <p className="text-sm text-gray-400 font-semibold mt-0.5">Review your order and confirm delivery details.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Shipping address */}
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#ff052f]" />
                <h2 className="text-sm font-extrabold text-gray-900">Shipping Address</h2>
              </div>

              {/* Street */}
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Street Address *</label>
                <input type="text" value={street} onChange={e => setStreet(e.target.value)}
                  placeholder="e.g. 14 Lugbe Road, Opposite Zenith Bank"
                  className="w-full px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-md text-xs bg-white" />
              </div>

              {/* Country + State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Country *</label>
                  <select value={country} onChange={e => { setCountry(e.target.value); setState(''); }}
                    className="w-full px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-md text-xs bg-white">
                    <option value="">Select country…</option>
                    {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">State / Province</label>
                  <select value={state} onChange={e => setState(e.target.value)}
                    disabled={!country || states.length === 0}
                    className="w-full px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-md text-xs bg-white disabled:opacity-50">
                    <option value="">Select state…</option>
                    {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* City + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">City *</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Abuja"
                    className="w-full px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-md text-xs bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Phone (optional)</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234 08X XXXX XXXX"
                    className="w-full px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-md text-xs bg-white" />
                </div>
              </div>
            </Card>

            {/* Order items */}
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#ff052f]" />
                <h2 className="text-sm font-extrabold text-gray-900">Order Items ({items.length})</h2>
              </div>
              <div className="space-y-3">
                {items.map(item => {
                  const img = itemImage(item);
                  const label = itemLabel(item);
                  const lineTotal = parseFloat(item.price) * item.quantity;
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-10 h-10 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {img
                          ? <img src={img} alt={label} className="w-full h-full object-cover" />
                          : item.frame_variant
                            ? <Glasses className="w-4 h-4 text-gray-300" />
                            : <Package className="w-4 h-4 text-gray-300" />}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{label}</p>
                        {item.lens_type_detail && <p className="text-[10px] text-gray-400">Lens: {item.lens_type_detail.name}</p>}
                        <p className="text-[10px] text-gray-400">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-xs font-extrabold text-gray-900 shrink-0">₦{lineTotal.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Payment method info */}
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-[#ff052f]" />
                <h2 className="text-sm font-extrabold text-gray-900">Payment</h2>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-md p-3 flex gap-2.5 text-xs text-green-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Secure payment via Paystack</span>
                  <span className="font-medium text-green-600">
                    Pay with card, bank transfer, or USSD. Your order is confirmed only after payment is verified.
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right — summary + pay */}
          <div className="space-y-4 lg:sticky lg:top-6">
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Order Summary</h3>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500 font-semibold">
                  <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                  <span className="font-bold text-gray-900">₦{Number(total).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-semibold">
                  <span>Shipping</span>
                  <span className="text-gray-400 italic">Calculated on dispatch</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="text-xs font-extrabold text-gray-900">Total</span>
                <span className="text-xl font-black text-[#ff052f]">₦{Number(total).toLocaleString()}</span>
              </div>

              {/* Readiness checklist */}
              <div className="space-y-1.5">
                <div className={cn("flex items-center gap-2 text-[10px] font-semibold",
                  street && city && country ? "text-green-600" : "text-gray-400")}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Shipping address {street && city && country ? 'ready' : 'required'}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {items.length} item{items.length !== 1 ? 's' : ''} in cart
                </div>
              </div>

              <Button
                className="w-full bg-[#ff052f] hover:bg-[#d90022] text-white font-bold rounded-md"
                onClick={handlePay}
                disabled={!canPay}>
                {paymentPhase !== 'idle'
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{payLabel}</>
                  : payLabel}
              </Button>

              {paymentPhase === 'popup_open' && (
                <p className="text-[10px] text-center text-gray-400 font-semibold">
                  Complete your payment in the Paystack window.
                </p>
              )}
            </Card>

            <div className="bg-gray-50 border border-gray-100 rounded-md p-4 flex gap-2.5">
              <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">
                Payments processed securely by Paystack. Orders are confirmed only after payment verification. Naderk never stores your card details.
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
