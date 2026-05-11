import type { Metadata } from "next"
import {
  OpticalStoreHeroSection,
  CategoryShowcaseSection,
  TrendingProductsSection,
  PrescriptionUploadSection,
  AuthorizedBrandsSection,
} from "@/components/page/services/optical-store/sections"

export const metadata: Metadata = {
  title: "Optical Store | Naderk Eye Centre",
  description:
    "Explore our curated collection of designer frames. Crystal clear vision meets timeless style at Naderk Optical Shop.",
}

export default function OpticalStorePage() {
  return (
    <main className="min-h-screen">
      <OpticalStoreHeroSection />
      <CategoryShowcaseSection />
      <TrendingProductsSection />
      <PrescriptionUploadSection />
      <AuthorizedBrandsSection />
    </main>
  )
}
