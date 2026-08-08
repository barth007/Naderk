import {
  AboutHeroSection,
  CorePillarsSection,
  PromiseMandateSection,
  TeamSection,
  VisionMissionSection,
} from "@/components/page/about/sections"
import { getSiteBrand } from "@/lib/site-brand";

export async function generateMetadata() {
  const brand = await getSiteBrand();
  return {
  title: "About Us",
  description:
    `Learn about ${brand.name}'s mission, vision, core pillars, and the expert team transforming eye care across Africa.`,
  };
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
