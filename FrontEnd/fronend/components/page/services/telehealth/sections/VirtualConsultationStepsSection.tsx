import { Card } from "@/components/ui"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { TELEHEALTH_CONTENT } from "./telehealth.constants"
import type { TelehealthStep } from "./telehealth.types"

function ProcessCard({ step, index }: { step: TelehealthStep; index: number }) {
  return (
    <Card className="flex flex-col items-center text-center p-8 rounded-md border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--destructive)]/5 text-[var(--destructive)] mb-6">
        <AnimatedIcon name={step.icon} size={28} />
      </div>
      <h3 className="text-lg font-bold text-foreground">
        {step.title}
      </h3>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground max-w-[240px]">
        {step.description}
      </p>
    </Card>
  )
}

export function VirtualConsultationStepsSection() {
  const { steps } = TELEHEALTH_CONTENT

  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-20 lg:py-24" aria-labelledby="steps-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12 lg:mb-16">
          <h2 id="steps-title" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {steps.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {steps.description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.items.map((step, index) => (
            <ProcessCard key={step.title} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
