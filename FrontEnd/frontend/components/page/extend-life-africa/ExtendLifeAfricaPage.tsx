'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, BookOpen, FlaskConical, Heart, Mail, Phone, Quote, Video,
} from 'lucide-react';
import { DonationCard, formatMoney } from './DonationCard';
import { VolunteerFormModal, VOLUNTEER_ROLES } from './VolunteerFormModal';
import { useElaContent, type ElaContent } from './useElaContent';
import type { VolunteerRole } from '@/services/donations/donations.hooks';

const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
const EYEBROW = 'text-[13px] font-bold uppercase tracking-[0.12em] text-[#B42318]';
const H2 = 'text-[28px] sm:text-[34px] lg:text-[40px] leading-[1.15] font-extrabold tracking-[-0.02em] text-[#1A1A2E]';

const HIGHLIGHT_ICONS = [FlaskConical, Video, BookOpen];

/** The /extend-life-africa page body. The site's own navbar and footer wrap it. */
export function ExtendLifeAfricaPage() {
  const content = useElaContent();
  const [volunteerRole, setVolunteerRole] = useState<VolunteerRole | null>(null);
  const [volunteerOpen, setVolunteerOpen] = useState(false);

  const openVolunteer = useCallback((role: VolunteerRole | null = null) => {
    setVolunteerRole(role);
    setVolunteerOpen(true);
  }, []);
  const closeVolunteer = useCallback(() => setVolunteerOpen(false), []);

  return (
    <div className="bg-white text-[#1A1A2E]">
      <Hero content={content} />
      <WaysToGive content={content} />
      <WhoWeAre content={content} />
      <WhatWeDo content={content} />
      <Volunteer content={content} onVolunteer={openVolunteer} />
      <Resources content={content} />
      <TrusteesAndContact content={content} />
      <Closing content={content} onVolunteer={() => openVolunteer()} />
      {volunteerOpen && <VolunteerFormModal initialRole={volunteerRole} onClose={closeVolunteer} />}
    </div>
  );
}

function Hero({ content }: { content: ElaContent }) {
  const { hero } = content;
  return (
    <section aria-labelledby="ela-title" className="relative overflow-hidden bg-[#FFF7F5]">
      <svg viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-10 h-[220px] w-full opacity-[0.18]">
        <polyline points="0,140 380,140 430,140 460,60 500,200 540,20 580,170 610,140 900,140 930,110 960,170 990,140 1440,140"
          fill="none" stroke="var(--destructive)" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className={`${CONTAINER} relative flex flex-wrap items-center gap-12 py-14 sm:py-[72px] lg:pb-[88px]`}>
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
          <span className="self-start rounded-full bg-[#FFE3E3] px-3.5 py-2 text-[13px] font-semibold text-[#9B1C1C]">
            {hero.badge}
          </span>
          <h1 id="ela-title" className="text-[36px] sm:text-[48px] lg:text-[60px] leading-[1.05] font-extrabold tracking-[-0.03em]">
            {hero.title}<br />
            <span className="text-[var(--destructive)]">{hero.highlight}</span>
          </h1>
          <p className="max-w-[560px] text-base sm:text-lg leading-[1.65] text-[#4A4A5A]">{hero.description}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#give"
              className="inline-flex min-h-[52px] items-center gap-2.5 rounded-xl bg-[var(--destructive)] px-6 text-base font-semibold text-white hover:brightness-95">
              {hero.primaryCtaLabel}<ArrowRight className="h-[18px] w-[18px]" aria-hidden />
            </a>
            <a href="#volunteer"
              className="inline-flex min-h-[52px] items-center rounded-xl border-[1.5px] border-[#E7D7D7] bg-white px-6 text-base font-semibold text-[#1A1A2E] hover:bg-[#FFF1F1]">
              {hero.secondaryCtaLabel}
            </a>
          </div>
          <ul className="flex flex-wrap gap-5 pt-2 text-sm text-[#4A4A5A]">
            {hero.highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
              return (
                <li key={`${h.label}-${i}`} className="flex items-center gap-2">
                  <Icon className="h-[18px] w-[18px] text-[var(--destructive)]" aria-hidden />{h.label}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex min-w-0 flex-[1_1_400px] justify-center lg:justify-end">
          <DonationCard content={content} />
        </div>
      </div>
    </section>
  );
}

function PriceChips({ content, kind, dark = false }: { content: ElaContent; kind: 'test' | 'intervention'; dark?: boolean }) {
  const p = content.giving.prices;
  return (
    <div className="mt-auto flex flex-wrap gap-2">
      {(['NGN', 'GBP', 'USD'] as const).map((code) => (
        <span key={code}
          className={dark ? 'rounded-full bg-white/[0.12] px-3 py-2 text-sm font-bold' : 'rounded-full bg-[#FFF7F5] px-3 py-2 text-sm font-bold text-[#1A1A2E]'}>
          {formatMoney(p[code][kind], code)}
        </span>
      ))}
    </div>
  );
}

function WaysToGive({ content }: { content: ElaContent }) {
  const w = content.waysToGive;
  const card = 'flex flex-col gap-4 rounded-[20px] p-7';
  return (
    <section id="involved" aria-labelledby="ways-title" className={`${CONTAINER} pt-20 sm:pt-24 pb-10`}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[640px]">
          <p className={`${EYEBROW} mb-2.5`}>{w.label}</p>
          <h2 id="ways-title" className={H2}>{w.title}</h2>
        </div>
        <p className="max-w-[420px] text-base leading-relaxed text-[#4A4A5A]">{w.description}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <article className={`${card} border border-[#F1E4E4] bg-white`}>
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[#FFF1F1]">
            <FlaskConical className="h-[26px] w-[26px] text-[var(--destructive)]" aria-hidden />
          </span>
          <h3 className="text-xl font-bold">{w.testTitle}</h3>
          <p className="text-[15px] leading-relaxed text-[#4A4A5A]">{w.testDescription}</p>
          <PriceChips content={content} kind="test" />
          <a href="#give" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-[#B42318] hover:text-[#7A1A10]">
            {w.testTitle} <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </article>

        <article className={`${card} relative overflow-hidden bg-[#1A1A2E] text-white`}>
          <span className="absolute right-5 top-5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1A1A2E]">
            Most impact
          </span>
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white/10">
            <Activity className="h-[26px] w-[26px] text-[#FFB4B4]" aria-hidden />
          </span>
          <h3 className="text-xl font-bold">{w.interventionTitle}</h3>
          <p className="text-[15px] leading-relaxed text-[#D9D9E3]">{w.interventionDescription}</p>
          <PriceChips content={content} kind="intervention" dark />
          <a href="#give" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-[#FFB4B4] hover:text-white">
            {w.interventionTitle} <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </article>

        <article className={`${card} border border-[#F1E4E4] bg-white`}>
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[#FFF1F1]">
            <Heart className="h-[26px] w-[26px] text-[var(--destructive)]" aria-hidden />
          </span>
          <h3 className="text-xl font-bold">{w.generalTitle}</h3>
          <p className="text-[15px] leading-relaxed text-[#4A4A5A]">{w.generalDescription}</p>
          <div className="mt-auto flex flex-wrap gap-2">
            <span className="rounded-full bg-[#FFF7F5] px-3 py-2 text-sm font-semibold">One-time</span>
            <span className="rounded-full bg-[#FFF7F5] px-3 py-2 text-sm font-semibold">Every year</span>
          </div>
          <a href="#give" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-[#B42318] hover:text-[#7A1A10]">
            Donate now <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </article>
      </div>
    </section>
  );
}

function WhoWeAre({ content }: { content: ElaContent }) {
  const w = content.whoWeAre;
  return (
    <section id="who" aria-labelledby="who-title" className={`${CONTAINER} py-16 sm:py-[72px]`}>
      <div className="flex flex-wrap items-start gap-14">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
          <p className={EYEBROW}>{w.label}</p>
          <h2 id="who-title" className={H2}>{w.title}</h2>
          <figure className="mt-2 flex flex-col gap-3.5 rounded-[20px] bg-[#FFF7F5] p-7">
            <Quote className="h-8 w-8 text-[var(--destructive)]" aria-hidden />
            <blockquote className="text-xl leading-normal font-semibold text-[#1A1A2E]">{w.quote}</blockquote>
          </figure>
        </div>
        <div className="flex min-w-0 flex-[1.3_1_480px] flex-col gap-[18px] text-base leading-[1.75] text-[#3D3D4E]">
          {w.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {w.highlights.map((h, i) => (
              <div key={`${h.title}-${i}`} className="rounded-2xl border border-[#F1E4E4] p-[18px]">
                <p className="mb-1 font-bold text-[#1A1A2E]">{h.title}</p>
                <p className="text-sm leading-normal text-[#5B5B6B]">{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatWeDo({ content }: { content: ElaContent }) {
  const w = content.whatWeDo;
  return (
    <section id="what" aria-labelledby="what-title" className="bg-[#FFF7F5]">
      <div className={`${CONTAINER} flex flex-col gap-11 py-20 sm:py-[88px]`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <p className={`${EYEBROW} mb-2.5`}>{w.label}</p>
            <h2 id="what-title" className={H2}>{w.title}</h2>
          </div>
          <p className="max-w-[460px] text-base leading-relaxed text-[#4A4A5A]">{w.description}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {w.pillars.map((p, i) => (
            <article key={`${p.title}-${i}`} className="flex flex-col gap-3 rounded-[20px] bg-white p-7">
              <p className="text-[44px] font-extrabold leading-none text-[#F3C9C9]" aria-hidden>{String(i + 1).padStart(2, '0')}</p>
              <h3 className="text-[19px] font-bold">{p.title}</h3>
              <p className="text-[15px] leading-relaxed text-[#4A4A5A]">{p.description}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="mr-1 text-sm font-semibold text-[#3D3D4E]">{w.conditionsLabel}</span>
          <ul className="flex flex-wrap gap-3">
            {w.conditions.map((c, i) => (
              <li key={`${c.name}-${i}`} className="rounded-full border border-[#F1E4E4] bg-white px-4 py-2.5 text-sm font-semibold">{c.name}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-6 rounded-3xl bg-white p-6 sm:p-8">
          <h3 className="text-[19px] font-bold">{w.journeyTitle}</h3>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {w.journey.map((step, i) => (
              <li key={`${step.title}-${i}`} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--destructive)] font-bold text-white">{i + 1}</span>
                <div>
                  <p className="mb-1 font-bold">{step.title}</p>
                  <p className="text-sm leading-normal text-[#5B5B6B]">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Volunteer({ content, onVolunteer }: { content: ElaContent; onVolunteer: (role?: VolunteerRole | null) => void }) {
  const v = content.volunteer;
  return (
    <section id="volunteer" aria-labelledby="vol-heading" className={`${CONTAINER} scroll-mt-24 pt-20 sm:pt-[88px] pb-10`}>
      <div className="flex flex-wrap items-center gap-10 rounded-[28px] bg-[#1A1A2E] p-7 text-white sm:p-14">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[18px]">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#FFB4B4]">{v.label}</p>
          <h2 id="vol-heading" className="text-[28px] sm:text-[34px] lg:text-[40px] leading-[1.15] font-extrabold tracking-[-0.02em]">{v.title}</h2>
          <p className="max-w-[560px] text-base leading-[1.7] text-[#D9D9E3]">{v.description}</p>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Volunteer as">
            {VOLUNTEER_ROLES.map((r) => (
              <button key={r.value} type="button" onClick={() => onVolunteer(r.value)}
                className="min-h-11 rounded-full border border-white/25 px-4 text-sm font-semibold hover:bg-white/10">
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onVolunteer(null)}
            className="mt-1.5 self-start inline-flex min-h-[52px] items-center rounded-xl bg-white px-6 text-base font-bold text-[#1A1A2E] hover:bg-[#FFF1F1]">
            {v.ctaLabel}
          </button>
        </div>
        <div className="grid min-w-0 flex-[1_1_340px] grid-cols-2 gap-3.5">
          <div className="col-span-2 flex flex-col gap-1.5 rounded-[20px] bg-white/[0.06] p-[22px]">
            <p className="text-[13px] text-[#BDBDCB]">Your commitment</p>
            <p className="text-[34px] font-extrabold">{v.commitment}</p>
          </div>
          {[{ bars: 4, label: '4 × 15 min', hint: 'short consultations' }, { bars: 3, label: '3 × 20 min', hint: 'longer consultations' }].map((f) => (
            <div key={f.label} className="flex flex-col gap-2.5 rounded-[20px] bg-white/[0.06] p-[22px]">
              <div className="flex gap-1.5" aria-hidden>
                {Array.from({ length: f.bars }).map((_, i) => <span key={i} className="h-2 flex-1 rounded bg-[#FFB4B4]" />)}
              </div>
              <p className="text-[22px] font-bold">{f.label}</p>
              <p className="text-[13px] text-[#BDBDCB]">{f.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Resources({ content }: { content: ElaContent }) {
  const r = content.resources;
  const items = r.items.filter((i) => i.title);
  if (!items.length) return null;
  return (
    <section id="resources" aria-labelledby="res-title" className={`${CONTAINER} py-14`}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`${EYEBROW} mb-2.5`}>{r.label}</p>
          <h2 id="res-title" className="text-[26px] sm:text-[34px] font-extrabold tracking-[-0.02em]">{r.title}</h2>
        </div>
        <Link href={r.linkHref} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-[#B42318] hover:text-[#7A1A10]">
          {r.linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {items.map((item, i) => (
          <a key={`${item.title}-${i}`} href={item.href || r.linkHref}
            className="flex flex-col overflow-hidden rounded-[20px] border border-[#F1E4E4] text-[#1A1A2E] hover:shadow-md transition-shadow">
            {item.image
              // eslint-disable-next-line @next/next/no-img-element -- CMS URLs from any host
              ? <img src={item.image} alt="" className="h-[150px] w-full object-cover" />
              : <div className="h-[150px] bg-[#FBEDED]" aria-hidden />}
            <div className="flex flex-col gap-1.5 p-5">
              <p className="text-[17px] font-bold">{item.title}</p>
              {item.summary && <p className="text-sm text-[#5B5B6B]">{item.summary}</p>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

function TrusteesAndContact({ content }: { content: ElaContent }) {
  const { trustees, contact } = content;
  const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
  return (
    <section aria-label="Trustees and contact" className={`${CONTAINER} flex flex-wrap gap-6 pt-10 pb-20 sm:pb-[88px]`}>
      <div id="trustees" className="flex min-w-0 flex-[1.4_1_480px] flex-col gap-6 rounded-3xl border border-[#F1E4E4] p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold">{trustees.title}</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trustees.members.map((m, i) => (
            <li key={`${m.name}-${i}`} className="flex items-center gap-3.5">
              {m.image
                // eslint-disable-next-line @next/next/no-img-element -- CMS URLs from any host
                ? <img src={m.image} alt="" className="h-[52px] w-[52px] shrink-0 rounded-full object-cover" />
                : <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#FFE3E3] font-bold text-[#9B1C1C]" aria-hidden>{initials(m.name)}</span>}
              <div>
                <p className="font-semibold">{m.name}</p>
                {m.role && <p className="text-[13px] text-[#6B6B7B]">{m.role}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div id="contact" className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] rounded-3xl bg-[#FFF7F5] p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold">{contact.title}</h2>
        {[
          { href: tel(contact.ngPhone), label: contact.ngLabel, value: contact.ngPhone, Icon: Phone },
          { href: tel(contact.ukPhone), label: contact.ukLabel, value: contact.ukPhone, Icon: Phone },
          { href: `mailto:${contact.email}`, label: 'Email', value: contact.email, Icon: Mail },
        ].map(({ href, label, value, Icon }) => (
          <a key={label} href={href} className="flex min-h-11 items-center gap-3 text-[#1A1A2E] hover:text-[#B42318]">
            <Icon className="h-5 w-5 shrink-0 text-[var(--destructive)]" aria-hidden />
            <span>
              <span className="block text-xs text-[#6B6B7B]">{label}</span>
              <span className="font-semibold">{value}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Closing({ content, onVolunteer }: { content: ElaContent; onVolunteer: () => void }) {
  const c = content.closing;
  return (
    <section aria-labelledby="close-title" className="bg-[var(--destructive)] text-white">
      <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-5 px-4 py-20 text-center sm:py-[88px]">
        <h2 id="close-title" className="text-[30px] sm:text-[40px] lg:text-[48px] leading-[1.1] font-extrabold tracking-[-0.02em]">{c.title}</h2>
        <p className="max-w-[680px] text-base sm:text-lg leading-[1.65] text-[#FFE9E9]">{c.description}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <a href="#give" className="inline-flex min-h-[52px] items-center rounded-xl bg-white px-7 text-base font-bold text-[#9B1C1C] hover:bg-[#FFF1F1]">
            {c.primaryCtaLabel}
          </a>
          <button type="button" onClick={onVolunteer}
            className="inline-flex min-h-[52px] items-center rounded-xl border-[1.5px] border-white/60 px-7 text-base font-semibold text-white hover:bg-white/10">
            {c.secondaryCtaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
