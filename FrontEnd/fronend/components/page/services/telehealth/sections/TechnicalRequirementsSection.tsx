import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { Card } from "@/components/ui"
import { TELEHEALTH_CONTENT } from "./telehealth.constants"
import type { TelehealthRequirement } from "./telehealth.types"

function RequirementItem({ item }: { item: TelehealthRequirement }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/5 text-[var(--destructive)]">
        <AnimatedIcon name={item.icon} size={20} />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{item.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      </div>
    </div>
  )
}

export function TechnicalRequirementsSection() {
  const { technical } = TELEHEALTH_CONTENT

  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24" aria-labelledby="technical-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Requirements */}
          <div>
            <h2 id="technical-title" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {technical.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {technical.description}
            </p>

            <div className="mt-10 space-y-8">
              {technical.requirements.map((item) => (
                <RequirementItem key={item.title} item={item} />
              ))}
            </div>
          </div>

          {/* Right: Privacy Card */}
          <Card className="p-8 lg:p-12 border-none bg-[#F9FAFB] rounded-[2.5rem]">
            <h3 className="text-2xl font-bold text-foreground">
              {technical.privacy.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {technical.privacy.description}
            </p>

            <ul className="mt-10 space-y-4">
              {technical.privacy.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <AnimatedIcon name="check" size={20} className="text-[var(--destructive)]" />
                  {feature}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  )
}
