import { cn } from "@/lib/cn"
import {
  WHY_CHOOSE_DESCRIPTION,
  WHY_CHOOSE_FEATURES,
  WHY_CHOOSE_TITLE,
} from "./why-choose.constants"
import { WhyChooseCard } from "./WhyChooseCard"
import type { WhyChooseSectionProps } from "./why-choose.types"

export function WhyChooseSection({
  title = WHY_CHOOSE_TITLE,
  description = WHY_CHOOSE_DESCRIPTION,
  features = WHY_CHOOSE_FEATURES,
}: WhyChooseSectionProps) {
  return (
    <section aria-labelledby="why-choose-heading" className="bg-muted/50 py-16 lg:py-0 lg:h-[487px] flex items-center">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-4xl">
          <h2
            id="why-choose-heading"
            className="text-balance text-3xl font-bold leading-tight text-foreground sm:text-4xl"
          >
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
        </header>

        <div
          className={cn(
            "mt-10 grid grid-cols-1 gap-6 sm:mt-12 md:grid-cols-2 md:gap-7 lg:grid-cols-4"
          )}
        >
          {features.map((feature, index) => (
            <WhyChooseCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
