import type { WhyChooseFeature } from "./why-choose.types"

export const WHY_CHOOSE_TITLE = "Why Choose NaderkEye?"

export const WHY_CHOOSE_DESCRIPTION =
  "We are committed to providing high-quality eye care services using advanced technology and experienced specialists."

export const WHY_CHOOSE_FEATURES: readonly WhyChooseFeature[] = [
  {
    title: "World Class Experts",
    description: "Our team consists of board-certified specialists with decades of experience in complex eye care.",
    icon: "check",
  },
  {
    title: "Advanced Technology",
    description: "We invest in the latest diagnostic and surgical equipment to ensure precise results and better outcomes.",
    icon: "electricity",
  },
  {
    title: "Patient-First Care",
    description: "Your comfort and well-being are our top priorities. We provide personalized care tailored to your needs.",
    icon: "shield",
  },
  {
    title: "Trusted Excellence",
    description: "With over 12 years of service, we have built a reputation for excellence and reliability in eye care.",
    icon: "like",
  },
] as const
