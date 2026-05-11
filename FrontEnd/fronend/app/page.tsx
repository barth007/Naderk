import { HeroSection } from "@/components/page/home/sections/hero"
import { TrustMetricsSection } from "@/components/page/home/sections/trust-metrics"
import { WhyChooseSection } from "@/components/page/home/sections/why-choose"
import { HowItWorksSection } from "@/components/page/home/sections/how-it-works"
import { HighlightsPromoSection } from "@/components/page/home/sections/highlights-promo"
import { TestimonialsWallSection } from "@/components/page/home/sections/testimonials-wall"
import { FAQSection } from "@/components/page/home/sections/faq"
import { SupportCTASection } from "@/components/page/home/sections/support-cta"

export default function Page() {
  return (
    <>
      <HeroSection />
      <TrustMetricsSection />
      <WhyChooseSection />
      <HowItWorksSection />
      <HighlightsPromoSection />
      <TestimonialsWallSection />
      <SupportCTASection />
      <FAQSection />
    </>
  )
}
