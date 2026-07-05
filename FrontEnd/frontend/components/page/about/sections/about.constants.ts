import type {
  AboutHeroContent,
  CorePillar,
  PromiseMandateContent,
  TeamMember,
  VisionMissionContent,
} from "./about.types"

export const ABOUT_HERO_CONTENT: AboutHeroContent = {
  badge: "About NaderkEye Center",
  title: "Our Identity & Commitment",
  description:
    "Naderk Eye Centre is a purpose-driven multispecialty healthcare institution, dedicated to transforming the landscape of eye care, diagnostics, preventive healthcare, and telehealth across Africa.",
  image: "/images/image 13.png",
  imageAlt: "Microscope lenses in a modern eye care clinic",
}

export const VISION_MISSION_CONTENT: VisionMissionContent = {
  label: "Our Legacy",
  vision: {
    title: "Our Vision",
    description:
      "To become a leading and sustainable centre of excellence in eye care, diagnostics, preventive healthcare, and multispecialty health services across Africa, recognised for innovation, compassion, and transformative impact.",
  },
  mission: {
    title: "Our Mission",
    description:
      "To deliver integrated, compassionate, and technologically advanced healthcare services that preserve sight, champion early disease detection, promote wellness, and empower communities. We achieve this by fostering a culture of respect, leveraging innovation, and remaining steadfast in our commitment to a higher purpose.",
  },
  image: "/images/image 11.png",
  imageAlt: "Ophthalmologist standing beside eye examination equipment",
  stats: [
    { value: "12+", label: "Years of Experience" },
    { value: "30+", label: "Specialist Team Members" },
    { value: "50K+", label: "Patients Supported" },
    { value: "20+", label: "Partner Clinics" },
  ],
}

export const CORE_PILLARS_TITLE = "Our Core Pillars: The Triad of Our Identity"
export const CORE_PILLARS_DESCRIPTION =
  "At the heart of our organisation lies a powerful tripartite philosophy that guides every decision and action"

export const CORE_PILLARS: readonly CorePillar[] = [
  {
    title: "Deity - Our Source and Foundation",
    description:
      "We operate with the profound belief that our work serves a greater good. This spiritual foundation provides our team with purpose, resilience, and a moral compass.",
    icon: "shield",
  },
  {
    title: "Humanity - People at the Heart of Our Work",
    description:
      "We foster an ecosystem of dignity and respect for our patients, our dedicated staff, and our stakeholders. We honour every individual with care and compassion.",
    icon: "users",
  },
  {
    title: "Technology - Innovation that Transforms Care",
    description:
      "We embrace cutting-edge technology as a catalyst for transformation. By leveraging diagnostics and telehealth, we deliver measurable care outcomes.",
    icon: "electricity",
  },
]

export const TEAM_SECTION_LABEL = "Our Team"
export const TEAM_SECTION_TITLE = "Meet Our Expert Team"
export const TEAM_SECTION_DESCRIPTION = "Specialists dedicated to your vision."

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    name: "Olivia Rhye",
    role: "Founder & CEO",
    image: "/assets/image 44.png",
    imageAlt: "Olivia Rhye portrait",
    description:
      "Former co-founder of Opendoor. Early staff at Spotify and Clearbit.",
    socials: [
      { platform: "twitter", href: "/coming-soon" },
      { platform: "linkedin", href: "/coming-soon" },
      { platform: "website", href: "/coming-soon" },
    ],
  },
  {
    name: "Phoenix Baker",
    role: "Engineering Manager",
    image: "/images/image 11.png",
    imageAlt: "Phoenix Baker portrait",
    description:
      "Lead engineering teams at Figma, Pitch, and Protocol Labs.",
    socials: [
      { platform: "twitter", href: "/coming-soon" },
      { platform: "linkedin", href: "/coming-soon" },
      { platform: "website", href: "/coming-soon" },
    ],
  },
  {
    name: "Lana Steiner",
    role: "Product Manager",
    image: "/assets/image 45.png",
    imageAlt: "Lana Steiner portrait",
    description:
      "Former PM for Linear, Lambda School, and On Deck.",
    socials: [
      { platform: "twitter", href: "/coming-soon" },
      { platform: "linkedin", href: "/coming-soon" },
      { platform: "website", href: "/coming-soon" },
    ],
  },
  {
    name: "Demi Wilkinson",
    role: "Frontend Developer",
    image: "/assets/image 5.png",
    imageAlt: "Demi Wilkinson portrait",
    description:
      "Former frontend dev for Linear, Coinbase, and Postscript.",
    socials: [
      { platform: "twitter", href: "/coming-soon" },
      { platform: "linkedin", href: "/coming-soon" },
      { platform: "website", href: "/coming-soon" },
    ],
  },
  {
    name: "Candice Wu",
    role: "Backend Developer",
    image: "/images/image 13.png",
    imageAlt: "Candice Wu portrait",
    description:
      "Lead backend dev at Clearbit. Former Clearbit and Loom.",
    socials: [
      { platform: "twitter", href: "/coming-soon" },
      { platform: "linkedin", href: "/coming-soon" },
      { platform: "website", href: "/coming-soon" },
    ],
  },
  {
    name: "Natali Craig",
    role: "Product Designer",
    image: "/images/image 11.png",
    imageAlt: "Natali Craig portrait",
    description:
      "Founding design team at Figma. Former Pleo, Stripe, and Tile.",
    socials: [
      { platform: "twitter", href: "/coming-soon" },
      { platform: "linkedin", href: "/coming-soon" },
      { platform: "website", href: "/coming-soon" },
    ],
  },
]

export const SOCIAL_ICONS = {
  twitter: "x",
  linkedin: "linkedin",
  website: "globe",
} as const

export const PROMISE_MANDATE_CONTENT: PromiseMandateContent = {
  title: "The Promise Mandate",
  description:
    "At Naderk Eye Centre, we are more than a healthcare provider; we are a beacon of hope, healing, and transformation. Guided by compassion and empowered by technology, we are dedicated to restoring sight, improving health, and enriching lives across Africa and beyond.",
  primaryCTA: {
    label: "Book Your Consultation",
    href: "/coming-soon",
  },
  secondaryCTA: {
    label: "View Our Services",
    href: "/coming-soon",
  },
}
