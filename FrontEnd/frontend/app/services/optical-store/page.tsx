import type { Metadata } from "next"
import {
  OpticalStoreHeroSection,
  CategoryShowcaseSection,
  TrendingProductsSection,
  PrescriptionUploadSection,
  AuthorizedBrandsSection,
} from "@/components/page/services/optical-store/sections"
import { getSiteBrand } from "@/lib/site-brand"

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getSiteBrand();
  return {
  title: "Optical Store",
  description:
    `Explore our curated collection of designer frames. Crystal clear vision meets timeless style at ${brand.name}.`,
  };
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
