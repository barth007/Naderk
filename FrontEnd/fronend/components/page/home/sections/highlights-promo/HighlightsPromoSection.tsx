import { HighlightFeature } from "./HighlightFeature";
import { PromoCard } from "./PromoCard";
import { HIGHLIGHTS, PROMO_CARDS } from "./highlights-promo.constants";

export function HighlightsPromoSection() {
  return (
    <section className="bg-background flex flex-col">
      {/* Part 1: Highlights Strip */}
      <div className="bg-[#E53E3E] py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            {HIGHLIGHTS.map((feature, index) => (
              <HighlightFeature key={index} feature={feature} />
            ))}
          </div>
        </div>
      </div>

      {/* Part 2: Promo Cards */}
      <div className="container mx-auto px-4 md:px-6 max-w-7xl py-16 md:py-24">
        <div className="grid gap-8 lg:grid-cols-2">
          {PROMO_CARDS.map((promo, index) => (
            <PromoCard key={index} promo={promo} />
          ))}
        </div>
      </div>
    </section>
  );
}
