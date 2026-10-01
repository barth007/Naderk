'use client';

import { usePageContent } from '@/services/cms/page-content.hooks';
import {
  ABOUT_HERO_CONTENT,
  VISION_MISSION_CONTENT,
  CORE_PILLARS,
  CORE_PILLARS_TITLE,
  CORE_PILLARS_DESCRIPTION,
  TEAM_SECTION_LABEL,
  TEAM_SECTION_TITLE,
  TEAM_SECTION_DESCRIPTION,
  PROMISE_MANDATE_CONTENT,
} from './sections/about.constants';

/**
 * About page copy, from the CMS where it has been set and the bundled
 * constants otherwise.
 *
 * The fallback matters: a section nobody has edited yet, or a request that
 * fails, must still render the page rather than blanking it. Each field falls
 * back individually, so a half-filled section is not all-or-nothing.
 */

type Section = Record<string, unknown>;

const str = (v: unknown, fallback: string) =>
  typeof v === 'string' && v.trim() ? v : fallback;

function list<T>(v: unknown, fallback: readonly T[]): readonly T[] {
  return Array.isArray(v) && v.length ? (v as T[]) : fallback;
}

export function useAboutContent() {
  const { data } = usePageContent('about');
  const s = (key: string): Section => (data?.[key] as Section) ?? {};

  const hero = s('hero');
  const vm = s('vision_mission');
  const pillars = s('core_pillars');
  const team = s('team_intro');
  const promise = s('promise_mandate');

  return {
    hero: {
      badge: str(hero.badge, ABOUT_HERO_CONTENT.badge),
      title: str(hero.title, ABOUT_HERO_CONTENT.title),
      description: str(hero.description, ABOUT_HERO_CONTENT.description),
      image: str(hero.image, ABOUT_HERO_CONTENT.image),
      imageAlt: str(hero.imageAlt, ABOUT_HERO_CONTENT.imageAlt),
    },
    visionMission: {
      label: str(vm.label, VISION_MISSION_CONTENT.label),
      vision: {
        title: str(vm.vision_title, VISION_MISSION_CONTENT.vision.title),
        description: str(vm.vision_description, VISION_MISSION_CONTENT.vision.description),
      },
      mission: {
        title: str(vm.mission_title, VISION_MISSION_CONTENT.mission.title),
        description: str(vm.mission_description, VISION_MISSION_CONTENT.mission.description),
      },
      image: str(vm.image, VISION_MISSION_CONTENT.image),
      imageAlt: str(vm.imageAlt, VISION_MISSION_CONTENT.imageAlt),
      stats: list(vm.stats, VISION_MISSION_CONTENT.stats),
    },
    corePillars: {
      title: str(pillars.title, CORE_PILLARS_TITLE),
      description: str(pillars.description, CORE_PILLARS_DESCRIPTION),
      pillars: list(pillars.pillars, CORE_PILLARS),
    },
    team: {
      label: str(team.label, TEAM_SECTION_LABEL),
      title: str(team.title, TEAM_SECTION_TITLE),
      description: str(team.description, TEAM_SECTION_DESCRIPTION),
    },
    promise: {
      title: str(promise.title, PROMISE_MANDATE_CONTENT.title),
      description: str(promise.description, PROMISE_MANDATE_CONTENT.description),
      primaryCTA: {
        label: str(promise.primary_cta_label, PROMISE_MANDATE_CONTENT.primaryCTA.label),
        href: str(promise.primary_cta_href, PROMISE_MANDATE_CONTENT.primaryCTA.href),
      },
      secondaryCTA: {
        label: str(promise.secondary_cta_label, PROMISE_MANDATE_CONTENT.secondaryCTA.label),
        href: str(promise.secondary_cta_href, PROMISE_MANDATE_CONTENT.secondaryCTA.href),
      },
    },
  };
}
