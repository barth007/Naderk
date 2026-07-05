import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/cn"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import {
  SOCIAL_ICONS,
  TEAM_MEMBERS,
  TEAM_SECTION_DESCRIPTION,
  TEAM_SECTION_LABEL,
  TEAM_SECTION_TITLE,
} from "./about.constants"
import type { SocialLink, TeamMember } from "./about.types"

function TeamSocialLink({ social }: { social: SocialLink }) {
  const iconName = SOCIAL_ICONS[social.platform]

  return (
    <Link
      href={social.href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
      aria-label={social.platform}
    >
      <AnimatedIcon name={iconName} size={16} aria-hidden />
    </Link>
  )
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <article className="rounded-xl bg-transparent p-1">
      <div className="mb-4 h-20 w-20 overflow-hidden rounded-full bg-card ring-4 ring-background shadow-sm">
        <Image
          src={member.image}
          alt={member.imageAlt}
          width={80}
          height={80}
          className="h-full w-full object-cover"
        />
      </div>

      <h3 className="text-base font-bold text-foreground">{member.name}</h3>
      <p className="mt-1 text-sm font-medium text-[var(--destructive)]">{member.role}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">{member.description}</p>

      <div className="mt-3 flex items-center gap-1">
        {member.socials.map((social, index) => (
          <TeamSocialLink key={`${member.name}-${social.platform}-${index}`} social={social} />
        ))}
      </div>
    </article>
  )
}

export function TeamSection() {
  return (
    <section className="bg-background py-12 sm:py-14 lg:py-16" aria-labelledby="team-section-title">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:px-8">
        <header className="lg:pt-2">
          <p className="text-xs font-semibold text-[var(--destructive)] uppercase tracking-wider">{TEAM_SECTION_LABEL}</p>
          <h2 id="team-section-title" className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            {TEAM_SECTION_TITLE}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{TEAM_SECTION_DESCRIPTION}</p>
        </header>

        <div className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3")}> 
          {TEAM_MEMBERS.map((member) => (
            <TeamMemberCard key={member.name} member={member} />
          ))}
        </div>
      </div>
    </section>
  )
}
