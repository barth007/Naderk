import type { Metadata } from "next"
import {
  TelehealthHeroSection,
  VirtualConsultationStepsSection,
  TechnicalRequirementsSection,
  TelehealthTestimonialSection,
  TelehealthCTASection,
} from "@/components/page/services/telehealth/sections"

export const metadata: Metadata = {
  title: "Telehealth & Virtual Eye Care | Naderk Eye Centre",
  description:
    "Connect with our leading ophthalmologists through a secure, high-definition video platform. Professional eye care consultations from the comfort of your home.",
}

export default function TelehealthPage() {
  return (
    <main className="min-h-screen">
      <TelehealthHeroSection />
      <VirtualConsultationStepsSection />
      <TechnicalRequirementsSection />
      <TelehealthTestimonialSection />
      <TelehealthCTASection />
    </main>
  )
}
