import type { Metadata } from "next"
import {
  LaboratoryHeroSection,
  ServicesOverviewSection,
  ResultsPortalCTASection,
  StandardsSection,
} from "@/components/page/services/laboratory/sections"

export const metadata: Metadata = {
  title: "Advanced Lab & Diagnostics | Naderk Eye Centre",
  description:
    "Precise testing for comprehensive eye health. Utilizing state of the art technology to detect, monitor, and manage ocular conditions with unparalleled accuracy.",
}

export default function LaboratoryPage() {
  return (
    <main className="min-h-screen">
      <LaboratoryHeroSection />
      <ServicesOverviewSection />
      <ResultsPortalCTASection />
      <StandardsSection />
    </main>
  )
}
