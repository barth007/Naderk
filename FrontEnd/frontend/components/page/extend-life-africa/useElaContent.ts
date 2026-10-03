'use client';

import { usePageContent } from '@/services/cms/page-content.hooks';
import type { DonationCurrency } from '@/services/donations/donations.hooks';
import { ELA_DEFAULTS as D } from './ela.constants';

/**
 * /extend-life-africa copy, from the CMS where it has been set and the bundled
 * defaults otherwise. Each field falls back on its own, so a half-filled
 * section still renders in full.
 */

type Section = Record<string, unknown>;

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);

function list<T>(v: unknown, fallback: readonly T[]): readonly T[] {
  return Array.isArray(v) && v.length ? (v as T[]) : fallback;
}

const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** "9999, 20000, …" → six positive numbers, or the defaults if that is not what was typed. */
const amounts = (v: unknown, fallback: number[]) => {
  if (typeof v !== 'string') return fallback;
  const parsed = v.split(',').map((x) => parseFloat(x.replace(/[^\d.]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length >= 3 ? parsed.slice(0, 6) : fallback;
};

export function useElaContent() {
  const { data } = usePageContent('extend_life_africa');
  const s = (key: string): Section => (data?.[key] as Section) ?? {};

  const hero = s('hero');
  const giving = s('giving');
  const ways = s('ways_to_give');
  const who = s('who_we_are');
  const what = s('what_we_do');
  const vol = s('volunteer');
  const res = s('resources');
  const trustees = s('trustees');
  const contact = s('contact');
  const closing = s('closing');

  const price = (code: DonationCurrency) => {
    const c = code.toLowerCase();
    return {
      test: num(giving[`test_price_${c}`], D.giving.prices[code].test),
      intervention: num(giving[`intervention_price_${c}`], D.giving.prices[code].intervention),
    };
  };

  return {
    hero: {
      badge: str(hero.badge, D.hero.badge),
      title: str(hero.title, D.hero.title),
      highlight: str(hero.highlight, D.hero.highlight),
      description: str(hero.description, D.hero.description),
      primaryCtaLabel: str(hero.primary_cta_label, D.hero.primaryCtaLabel),
      secondaryCtaLabel: str(hero.secondary_cta_label, D.hero.secondaryCtaLabel),
      highlights: list(hero.highlights, D.hero.highlights) as readonly { label: string }[],
    },
    giving: {
      cardTitle: str(giving.card_title, D.giving.cardTitle),
      prices: { NGN: price('NGN'), GBP: price('GBP'), USD: price('USD') },
      amounts: {
        NGN: amounts(giving.amounts_ngn, D.giving.amounts.NGN),
        GBP: amounts(giving.amounts_gbp, D.giving.amounts.GBP),
        USD: amounts(giving.amounts_usd, D.giving.amounts.USD),
      },
    },
    waysToGive: {
      label: str(ways.label, D.waysToGive.label),
      title: str(ways.title, D.waysToGive.title),
      description: str(ways.description, D.waysToGive.description),
      testTitle: str(ways.test_title, D.waysToGive.testTitle),
      testDescription: str(ways.test_description, D.waysToGive.testDescription),
      interventionTitle: str(ways.intervention_title, D.waysToGive.interventionTitle),
      interventionDescription: str(ways.intervention_description, D.waysToGive.interventionDescription),
      generalTitle: str(ways.general_title, D.waysToGive.generalTitle),
      generalDescription: str(ways.general_description, D.waysToGive.generalDescription),
    },
    whoWeAre: {
      label: str(who.label, D.whoWeAre.label),
      title: str(who.title, D.whoWeAre.title),
      quote: str(who.quote, D.whoWeAre.quote),
      paragraphs: str(who.body, D.whoWeAre.body).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      highlights: list(who.highlights, D.whoWeAre.highlights) as readonly { title: string; description: string }[],
    },
    whatWeDo: {
      label: str(what.label, D.whatWeDo.label),
      title: str(what.title, D.whatWeDo.title),
      description: str(what.description, D.whatWeDo.description),
      pillars: list(what.pillars, D.whatWeDo.pillars) as readonly { title: string; description: string }[],
      conditionsLabel: str(what.conditions_label, D.whatWeDo.conditionsLabel),
      conditions: list(what.conditions, D.whatWeDo.conditions) as readonly { name: string }[],
      journeyTitle: str(what.journey_title, D.whatWeDo.journeyTitle),
      journey: list(what.journey, D.whatWeDo.journey) as readonly { title: string; description: string }[],
    },
    volunteer: {
      label: str(vol.label, D.volunteer.label),
      title: str(vol.title, D.volunteer.title),
      description: str(vol.description, D.volunteer.description),
      commitment: str(vol.commitment, D.volunteer.commitment),
      ctaLabel: str(vol.cta_label, D.volunteer.ctaLabel),
    },
    resources: {
      label: str(res.label, D.resources.label),
      title: str(res.title, D.resources.title),
      linkLabel: str(res.link_label, D.resources.linkLabel),
      linkHref: str(res.link_href, D.resources.linkHref),
      // No fallback items: the section is hidden until resources are added.
      items: (Array.isArray(res.items) ? res.items : []) as { title?: string; summary?: string; image?: string; href?: string }[],
    },
    trustees: {
      title: str(trustees.title, D.trustees.title),
      members: list(trustees.members, D.trustees.members) as readonly { name: string; role?: string; image?: string }[],
    },
    contact: {
      title: str(contact.title, D.contact.title),
      ngLabel: str(contact.ng_label, D.contact.ngLabel),
      ngPhone: str(contact.ng_phone, D.contact.ngPhone),
      ukLabel: str(contact.uk_label, D.contact.ukLabel),
      ukPhone: str(contact.uk_phone, D.contact.ukPhone),
      email: str(contact.email, D.contact.email),
    },
    closing: {
      title: str(closing.title, D.closing.title),
      description: str(closing.description, D.closing.description),
      primaryCtaLabel: str(closing.primary_cta_label, D.closing.primaryCtaLabel),
      secondaryCtaLabel: str(closing.secondary_cta_label, D.closing.secondaryCtaLabel),
    },
  };
}

export type ElaContent = ReturnType<typeof useElaContent>;
