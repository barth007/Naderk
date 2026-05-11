import {
  AboutHeroSection,
  CorePillarsSection,
  PromiseMandateSection,
  TeamSection,
  VisionMissionSection,
} from "@/components/page/about/sections"

export const metadata = {
  title: "About Us - NaderkEye",
  description:
    "Learn about NaderkEye's mission, vision, core pillars, and the expert team transforming eye care across Africa.",
}

export default function AboutPage() {
  return (
    <>
      <AboutHeroSection />
      <VisionMissionSection />
      <CorePillarsSection />
      <TeamSection />
      <PromiseMandateSection />
    </>
  )
}
