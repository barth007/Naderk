'use client'

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/cn"
import { AnimatedIcon, type AnimatedIconName } from "@/components/ui/AnimatedIcon"
import { useTeamMembers } from '@/services/cms/admin-cms.hooks'
import { safeUrl } from "@/components/shared/ProfileModal"
import {
  SOCIAL_ICONS,
  TEAM_MEMBERS,
  TEAM_SECTION_DESCRIPTION,
  TEAM_SECTION_LABEL,
  TEAM_SECTION_TITLE,
} from "./about.constants"

type Member = {
  name: string
  role: string
  bio: string
  image: string
  imageAlt: string
  socials: { label: string; icon: AnimatedIconName; href: string }[]
}

const FALLBACK: Member[] = TEAM_MEMBERS.map(m => ({
  name: m.name,
  role: m.role,
  bio: m.description,
  image: m.image,
  imageAlt: m.imageAlt,
  socials: m.socials.map(s => ({ label: s.platform, icon: SOCIAL_ICONS[s.platform], href: s.href })),
}))

/**
 * One member as a round photo. Hovering it (or focusing / tapping it) opens a
 * card underneath with their name, position, bio and links. The card sits
 * flush against the photo so the pointer can move onto its links.
 */
function TeamAvatar({ member }: { member: Member }) {
  const [pinned, setPinned] = useState(false)
  const ref = useRef<HTMLLIElement>(null)

  // A tap pins the card open on touch screens; tapping elsewhere or Escape closes it.
  useEffect(() => {
    if (!pinned) return
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setPinned(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [pinned])

  return (
    <li ref={ref} className="group relative">
      <button
        type="button"
        onClick={() => setPinned(p => !p)}
        aria-expanded={pinned}
        aria-label={`${member.name}, ${member.role}`}
        className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--destructive)]"
      >
        <span className="block h-20 w-20 overflow-hidden rounded-full bg-card ring-4 ring-background shadow-sm transition-all duration-200 group-hover:ring-[#FFD5D5] group-hover:scale-105 sm:h-24 sm:w-24">
          {member.image ? (
            <Image
              src={member.image}
              alt={member.imageAlt}
              width={96}
              height={96}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-red-50 text-xl font-bold text-[#E03E3E]">
              {member.name.charAt(0)}
            </span>
          )}
        </span>
      </button>

      <div
        className={cn(
          "absolute left-1/2 top-full z-30 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-3",
          "invisible opacity-0 translate-y-1 transition-all duration-150",
          "group-hover:visible group-hover:opacity-100 group-hover:translate-y-0",
          "group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0",
          pinned && "visible opacity-100 translate-y-0",
        )}
      >
        <div className="relative rounded-xl border border-border bg-card p-4 text-left shadow-xl">
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-border bg-card" aria-hidden />
          <h3 className="text-base font-bold text-foreground">{member.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-[var(--destructive)]">{member.role}</p>
          {member.bio && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{member.bio}</p>}
          {member.socials.length > 0 && (
            <div className="mt-3 flex items-center gap-1">
              {member.socials.map((s, i) => (
                <a
                  key={`${s.label}-${i}`}
                  href={s.href}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#FFF1F1] hover:text-[var(--destructive)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  <AnimatedIcon name={s.icon} size={16} aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function TeamSection() {
  const { data: apiMembers } = useTeamMembers()

  const members: Member[] = apiMembers && apiMembers.length > 0
    ? apiMembers.map(m => ({
        name: m.name,
        role: m.role,
        bio: m.bio,
        image: m.image_url,
        imageAlt: `${m.name} portrait`,
        socials: ([
          { label: 'X', icon: 'x', href: safeUrl(m.twitter_url) },
          { label: 'LinkedIn', icon: 'linkedin', href: safeUrl(m.linkedin_url) },
          { label: 'Instagram', icon: 'globe', href: safeUrl(m.instagram_url) },
        ] as const).filter((s): s is typeof s & { href: string } => s.href !== null),
      }))
    : FALLBACK

  return (
    <section className="bg-background py-12 sm:py-14 lg:py-16" aria-labelledby="team-section-title">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        {/* Header and photos side by side on desktop, the header centred against however many rows of photos there are. */}
        <header className="mx-auto max-w-md text-center lg:mx-0 lg:text-left">
          <p className="text-xs font-semibold text-[var(--destructive)] uppercase tracking-wider">{TEAM_SECTION_LABEL}</p>
          <h2 id="team-section-title" className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            {TEAM_SECTION_TITLE}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{TEAM_SECTION_DESCRIPTION}</p>
        </header>

        <ul className="grid grid-cols-3 justify-items-center gap-6 sm:grid-cols-4">
          {members.map((member, i) => (
            <TeamAvatar key={`${member.name}-${i}`} member={member} />
          ))}
        </ul>
      </div>
    </section>
  )
}
