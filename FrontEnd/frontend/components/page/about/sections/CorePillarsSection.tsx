import { PillarCard } from "./PillarCard"
import {
  CORE_PILLARS,
  CORE_PILLARS_DESCRIPTION,
  CORE_PILLARS_TITLE,
} from "./about.constants"

export function CorePillarsSection() {
  return (
    <section className="bg-[#F9FAFB] py-12 sm:py-14 lg:py-16" aria-labelledby="core-pillars-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <h2 id="core-pillars-title" className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {CORE_PILLARS_TITLE}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {CORE_PILLARS_DESCRIPTION}
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CORE_PILLARS.map((pillar, index) => (
            <PillarCard key={pillar.title} pillar={pillar} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
