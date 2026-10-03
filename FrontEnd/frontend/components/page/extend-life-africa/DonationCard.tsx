'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, HeartPulse, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { parseApiError } from '@/lib/api-errors';
import { usePaymentCheckout } from '@/services/payments/payments.hooks';
import { usePaymentGateways } from '@/services/payments/admin-payments.hooks';
import {
  useStartDonation, verifyDonation,
  type DonationCurrency, type DonationFrequency, type DonationStatus,
} from '@/services/donations/donations.hooks';
import { AMOUNT_LIMITS, CURRENCIES } from './ela.constants';
import type { ElaContent } from './useElaContent';

type Phase = 'form' | 'starting' | 'paying' | 'confirming' | 'done';

const symbolOf = (code: DonationCurrency) => CURRENCIES.find((c) => c.code === code)!.symbol;

export function formatMoney(amount: number, code: DonationCurrency) {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return symbolOf(code) + amount.toLocaleString('en-GB', {
    minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2,
  });
}

function tierCaption(amount: number, price: { test: number; intervention: number }) {
  if (amount >= price.intervention) {
    const k = Math.floor(amount / price.intervention);
    return `${k} intervention${k === 1 ? '' : 's'}`;
  }
  const t = Math.max(1, Math.floor(amount / price.test));
  return `${t} test${t === 1 ? '' : 's'}`;
}

function impactText(amount: number, price: { test: number; intervention: number }, annual: boolean) {
  let text: string;
  if (amount <= 0) return 'Enter an amount to see what it pays for.';
  if (amount >= price.intervention) {
    const k = Math.floor(amount / price.intervention);
    text = `funds ${k} full intervention${k === 1 ? '' : 's'} — screening, consultation and follow-up care`;
  } else if (amount >= price.test) {
    const t = Math.floor(amount / price.test);
    text = `sponsors ${t} early-detection test${t === 1 ? '' : 's'} for someone who could not afford one`;
  } else {
    text = 'goes straight into tests, interventions and health education';
  }
  return `${text}${annual ? ' — every year' : ''}.`;
}

const newAttemptKey = () => `gift-${crypto.randomUUID()}`;

/**
 * The gift form on /extend-life-africa.
 *
 * Opens the gateway's popup for exactly the amount the server priced, then
 * asks the server (which asks the provider) whether it was paid. The webhook
 * and the reconcile job confirm the gift too, so a donor who closes the tab
 * early is still recorded — this is only what the donor sees.
 */
export function DonationCard({ content }: { content: ElaContent }) {
  const { user } = useAuth();
  const payCheckout = usePaymentCheckout();
  const { data: gateways = [] } = usePaymentGateways();

  const [currency, setCurrency] = useState<DonationCurrency>('NGN');
  const [frequency, setFrequency] = useState<DonationFrequency>('ONE_TIME');
  const [pick, setPick] = useState<number | 'custom'>(1);
  const [custom, setCustom] = useState('');
  // null until the donor types: until then a signed-in donor's own details show.
  const [nameInput, setName] = useState<string | null>(null);
  const [emailInput, setEmail] = useState<string | null>(null);
  const [dedicate, setDedicate] = useState(false);
  const [dedicatee, setDedicatee] = useState('');
  const [chosenGateway, setGateway] = useState('');

  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reference, setReference] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [result, setResult] = useState<DonationStatus | null>(null);
  const [attemptKey, setAttemptKey] = useState(newAttemptKey);
  const start = useStartDonation(attemptKey);

  // Signed-in donors don't retype what we already know.
  const name = nameInput ?? (user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '');
  const email = emailInput ?? user?.email ?? '';

  // Monnify only takes Naira, so it is not offered for £ or $.
  const usableGateways = useMemo(
    () => gateways.filter((g) => currency === 'NGN' || g.provider !== 'MONNIFY'),
    [gateways, currency],
  );
  const gateway = usableGateways.some((g) => g.provider === chosenGateway)
    ? chosenGateway
    : ((usableGateways.find((g) => g.is_default) ?? usableGateways[0])?.provider ?? '');
  const noGatewayForCurrency = gateways.length > 0 && usableGateways.length === 0;

  const price = content.giving.prices[currency];
  const tiers = content.giving.amounts[currency];
  const customAmount = parseFloat(custom);
  const amount = pick === 'custom' ? (customAmount > 0 ? customAmount : 0) : tiers[pick] ?? 0;
  const annual = frequency === 'ANNUAL';
  const limits = AMOUNT_LIMITS[currency];

  // ── Confirmation poll ────────────────────────────────────────────────────
  // Read by the interval and the popup's callbacks, which outlive the render
  // they were created in.
  const pollsRef = useRef(polls);
  const phaseRef = useRef(phase);
  useEffect(() => { pollsRef.current = polls; }, [polls]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (phase !== 'confirming' || !reference) return;
    let stopped = false;
    const id = setInterval(async () => {
      if (stopped) return;
      try {
        const status = await verifyDonation(reference);
        if (status.status === 'PAID') {
          stopped = true;
          clearInterval(id);
          setResult(status);
          setPhase('done');
          return;
        }
      } catch { /* the provider may be slow; keep asking */ }
      if (pollsRef.current <= 1) {
        stopped = true;
        clearInterval(id);
        setPhase('form');
        setAttemptKey(newAttemptKey());
        setError(
          'We have not had confirmation of your payment yet. If you were charged, your gift will be ' +
          'recorded and your receipt emailed shortly — please do not pay again.',
        );
      }
      setPolls((n) => n - 1);
    }, 3000);
    return () => { stopped = true; clearInterval(id); };
  }, [phase, reference]);

  const confirm = (attempts: number) => {
    setPolls(attempts);
    setPhase('confirming');
  };

  const pickCurrency = (code: DonationCurrency) => {
    setCurrency(code);
    setPick(1);
    setCustom('');
  };

  const submit = async () => {
    setError(null);
    setFieldErrors({});
    const local: Record<string, string> = {};
    if (!name.trim()) local.donor_name = 'Please tell us your name.';
    if (!email.trim()) local.donor_email = 'We need an email address to send your receipt.';
    if (amount < limits.min) local.amount = `The smallest gift is ${formatMoney(limits.min, currency)}.`;
    if (amount > limits.max) local.amount = `For gifts above ${formatMoney(limits.max, currency)}, please contact us.`;
    if (Object.keys(local).length) { setFieldErrors(local); return; }

    setPhase('starting');
    let data;
    try {
      data = await start.mutateAsync({
        donor_name: name.trim(),
        donor_email: email.trim(),
        currency,
        amount: amount.toFixed(2),
        frequency,
        dedicated_to: dedicate ? dedicatee.trim() : '',
        provider: gateway || undefined,
      });
    } catch (err) {
      const info = parseApiError(err, 'We could not start your payment. Please try again.');
      setFieldErrors(info.fieldErrors);
      setError(info.description ? `${info.title} ${info.description}` : info.title);
      setPhase('form');
      setAttemptKey(newAttemptKey());
      return;
    }

    setReference(data.reference);
    setPhase('paying');
    payCheckout({
      provider: data.provider,
      publicConfig: data.public_config ?? { public_key: data.public_key },
      amountKobo: data.amount_minor,
      email: data.email,
      reference: data.reference,
      customerName: data.donor_name,
      paymentDescription: 'Extend Life Africa donation',
      accessCode: data.access_code,
      // ~2 minutes after the gateway says it went through; bank transfers can lag.
      onSuccess: () => confirm(40),
      // Closed without success: a transfer may still land, so check briefly.
      onClose: () => {
        if (phaseRef.current === 'paying') confirm(5);
      },
    });
  };

  const reset = () => {
    setPhase('form');
    setResult(null);
    setReference(null);
    setError(null);
    setAttemptKey(newAttemptKey());
  };

  // ── Thank-you ────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    const paid = parseFloat(result.amount);
    return (
      <section id="give" aria-live="polite"
        className="w-full max-w-[480px] rounded-3xl bg-white p-7 shadow-[0_30px_60px_-30px_rgba(120,20,20,0.35)] ring-1 ring-[#F1E4E4] flex flex-col items-center text-center gap-4">
        <span className="w-16 h-16 rounded-full bg-[#FDE8EC] flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-[var(--destructive)]" aria-hidden />
        </span>
        <h2 className="text-2xl font-extrabold text-[#1A1A2E]">Thank you, {name.split(' ')[0] || 'friend'}.</h2>
        <p className="text-[15px] leading-relaxed text-[#4A4A5A]">
          Your gift of <strong className="text-[#1A1A2E]">{formatMoney(paid, result.currency)}</strong>{' '}
          {impactText(paid, content.giving.prices[result.currency], false)}
        </p>
        {result.frequency === 'ANNUAL' && result.next_reminder_on && (
          <p className="text-sm text-[#4A4A5A] bg-[#FFF7F5] rounded-xl px-4 py-3">
            We will email you a reminder around{' '}
            <strong>{new Date(result.next_reminder_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
            Nothing will be charged automatically.
          </p>
        )}
        <p className="text-sm text-[#6B6B7B]">A receipt is on its way to {email}.</p>
        <button type="button" onClick={reset}
          className="mt-2 min-h-11 px-5 rounded-xl border border-[#E7DEDE] text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFF7F5]">
          Give again
        </button>
      </section>
    );
  }

  const busy = phase !== 'form';
  const inputClass = (field: string) => cn(
    'w-full min-h-12 rounded-xl border-[1.5px] px-3.5 text-[15px] text-[#1A1A2E] bg-white outline-none focus:border-[var(--destructive)]',
    fieldErrors[field] ? 'border-red-400' : 'border-[#E7DEDE]',
  );

  return (
    <section id="give" aria-labelledby="give-title"
      className="w-full max-w-[480px] scroll-mt-24 rounded-3xl bg-white p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(120,20,20,0.35)] ring-1 ring-[#F1E4E4] flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="give-title" className="text-xl font-bold text-[#1A1A2E]">{content.giving.cardTitle}</h2>
        <div role="group" aria-label="Currency" className="flex gap-1 rounded-[10px] bg-[#F6F1F1] p-1">
          {CURRENCIES.map((c) => (
            <button key={c.code} type="button" aria-pressed={currency === c.code} disabled={busy}
              onClick={() => pickCurrency(c.code)}
              className={cn('min-h-9 px-3 rounded-lg text-[13px] font-semibold transition-colors',
                currency === c.code ? 'bg-white text-[#1A1A2E] shadow-sm font-bold' : 'text-[#5B5B6B] hover:text-[#1A1A2E]')}>
              <span aria-hidden>{c.symbol} </span>{c.code}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="How often" className="grid grid-cols-2 gap-2">
        {([['ONE_TIME', 'One-time'], ['ANNUAL', 'Every year']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={frequency === value} disabled={busy}
            onClick={() => setFrequency(value)}
            className={cn('min-h-[46px] rounded-xl border-[1.5px] text-sm font-semibold transition-colors',
              frequency === value
                ? 'border-[var(--destructive)] bg-[#FFF1F1] text-[#9B1C1C]'
                : 'border-[#E7DEDE] bg-white text-[#3D3D4E] hover:border-[#d9c6c6]')}>
            {label}
          </button>
        ))}
      </div>
      {annual && (
        <p className="-mt-3 text-xs text-[#6B6B7B]">
          You pay once now. A year from now we email you a reminder to give again — nothing is charged automatically.
        </p>
      )}

      <div role="group" aria-label="Amount" className="grid grid-cols-3 gap-2">
        {tiers.map((value, i) => {
          const selected = pick === i;
          return (
            <button key={`${currency}-${value}`} type="button" aria-pressed={selected} disabled={busy}
              onClick={() => { setPick(i); setCustom(''); }}
              className={cn('min-h-16 rounded-xl border-[1.5px] px-1.5 py-2 flex flex-col items-center justify-center gap-0.5 transition-colors',
                selected
                  ? 'border-[var(--destructive)] bg-[var(--destructive)] text-white'
                  : 'border-[#E7DEDE] bg-white text-[#1A1A2E] hover:border-[#d9c6c6]')}>
              <span className="text-base font-bold">{formatMoney(value, currency)}</span>
              <span className={cn('text-[11px]', selected ? 'text-white/90' : 'text-[#6B6B7B]')}>{tierCaption(value, price)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ela-custom" className="text-[13px] font-semibold text-[#3D3D4E]">Or give your own amount</label>
        <div className={cn('flex items-center gap-2 rounded-xl border-[1.5px] px-3.5 min-h-[52px] focus-within:border-[var(--destructive)]',
          fieldErrors.amount ? 'border-red-400' : 'border-[#E7DEDE]')}>
          <span className="text-lg font-bold text-[#5B5B6B]" aria-hidden>{symbolOf(currency)}</span>
          <input id="ela-custom" type="number" inputMode="decimal" min={limits.min} step="any" placeholder="Enter amount"
            value={custom} disabled={busy}
            onChange={(e) => { setCustom(e.target.value); setPick('custom'); }}
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-[#1A1A2E] outline-none" />
          <span className="text-xs font-semibold text-[#6B6B7B]">{currency}</span>
        </div>
        {fieldErrors.amount && <p className="text-xs text-red-600">{fieldErrors.amount}</p>}
      </div>

      <div className="flex gap-3 items-start rounded-2xl bg-[#FFF7F5] px-4 py-3.5">
        <HeartPulse className="w-[22px] h-[22px] shrink-0 mt-px text-[var(--destructive)]" aria-hidden />
        <p className="text-sm leading-normal text-[#3D3D4E]" aria-live="polite">
          <strong className="text-[#1A1A2E]">
            Your {amount > 0 ? `${formatMoney(amount, currency)}${annual ? ' a year' : ''}` : 'gift'}
          </strong>{' '}
          {impactText(amount, price, annual)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ela-name" className="text-[13px] font-semibold text-[#3D3D4E]">Your name</label>
          <input id="ela-name" autoComplete="name" value={name} disabled={busy}
            onChange={(e) => setName(e.target.value)} className={inputClass('donor_name')} />
          {fieldErrors.donor_name && <p className="text-xs text-red-600">{fieldErrors.donor_name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ela-email" className="text-[13px] font-semibold text-[#3D3D4E]">Email for your receipt</label>
          <input id="ela-email" type="email" autoComplete="email" value={email} disabled={busy}
            onChange={(e) => setEmail(e.target.value)} className={inputClass('donor_email')} />
          {fieldErrors.donor_email && <p className="text-xs text-red-600">{fieldErrors.donor_email}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 text-sm text-[#3D3D4E] min-h-11 cursor-pointer">
          <input type="checkbox" checked={dedicate} disabled={busy} onChange={(e) => setDedicate(e.target.checked)}
            className="w-[18px] h-[18px] accent-[var(--destructive)]" />
          Dedicate this donation to someone
        </label>
        {dedicate && (
          <input aria-label="Who is this gift in honour of?" placeholder="In honour of…" value={dedicatee} disabled={busy}
            onChange={(e) => setDedicatee(e.target.value)} className={inputClass('dedicated_to')} />
        )}
      </div>

      {usableGateways.length > 1 && (
        <div role="group" aria-label="Pay with" className="flex flex-wrap gap-2">
          {usableGateways.map((g) => (
            <button key={g.provider} type="button" aria-pressed={gateway === g.provider} disabled={busy}
              onClick={() => setGateway(g.provider)}
              className={cn('min-h-10 px-3.5 rounded-lg border text-[13px] font-semibold',
                gateway === g.provider ? 'border-[var(--destructive)] text-[#9B1C1C] bg-[#FFF1F1]' : 'border-[#E7DEDE] text-[#3D3D4E]')}>
              {g.display_name}
            </button>
          ))}
        </div>
      )}

      {noGatewayForCurrency && (
        <p className="text-sm text-[#9B1C1C] bg-[#FFF1F1] rounded-xl px-4 py-3">
          Gifts in {currency} are not available yet. Please give in Naira.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#9B1C1C] bg-[#FFF1F1] rounded-xl px-4 py-3">{error}</p>
      )}

      <button type="button" onClick={submit} disabled={busy || noGatewayForCurrency || amount <= 0}
        className="min-h-14 rounded-2xl bg-[var(--destructive)] text-white text-base font-bold flex items-center justify-center gap-2.5 hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed">
        {phase === 'form' && (<>Donate {amount > 0 ? formatMoney(amount, currency) : ''}{annual && amount > 0 ? ' yearly' : ''}<ArrowRight className="w-[18px] h-[18px]" aria-hidden /></>)}
        {phase === 'starting' && (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden />Preparing payment…</>)}
        {phase === 'paying' && (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden />Complete your payment…</>)}
        {phase === 'confirming' && (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden />Confirming your gift…</>)}
      </button>
      <p className="-mt-2 flex items-center justify-center gap-1.5 text-xs text-[#6B6B7B]">
        <Lock className="w-3.5 h-3.5" aria-hidden />Secure payment. No account needed.
      </p>
    </section>
  );
}
