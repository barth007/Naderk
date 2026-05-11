import { AnimatedIconName } from "@/components/ui/AnimatedIcon"

export interface AboutHeroContent {
  badge: string
  title: string
  description: string
  image: string
  imageAlt: string
}

export interface VisionMissionBlock {
  title: string
  description: string
}

export interface VisionMissionStat {
  value: string
  label: string
}

export interface VisionMissionContent {
  label: string
  vision: VisionMissionBlock
  mission: VisionMissionBlock
  image: string
  imageAlt: string
  stats: readonly VisionMissionStat[]
}

export interface CorePillar {
  title: string
  description: string
  icon: AnimatedIconName
}

export interface SocialLink {
  platform: "twitter" | "linkedin" | "website"
  href: string
}

export interface TeamMember {
  name: string
  role: string
  image: string
  imageAlt: string
  description: string
  socials: readonly SocialLink[]
}

export interface PromiseMandateContent {
  title: string
  description: string
  primaryCTA: {
    label: string
    href: string
  }
  secondaryCTA: {
    label: string
    href: string
  }
}
