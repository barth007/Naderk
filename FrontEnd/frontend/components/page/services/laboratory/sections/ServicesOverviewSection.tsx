import { Card } from "@/components/ui"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { LABORATORY_CONTENT } from "./laboratory.constants"
import type { LabServiceCard } from "./laboratory.types"

function ServiceCard({ service }: { service: LabServiceCard }) {
  return (
    <Card className="flex flex-col items-start p-6 rounded-md border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)]">
        <AnimatedIcon name={service.icon} size={20} />
      </div>
      <h3 className="mt-5 text-base font-bold text-foreground">
        {service.title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {service.description}
      </p>
    </Card>
  )
}

export function ServicesOverviewSection() {
  const { overview } = LABORATORY_CONTENT

  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-20 lg:py-24" aria-labelledby="overview-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="overview-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {overview.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {overview.description}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {overview.services.map((service) => (
            <ServiceCard key={service.title} service={service} />
          ))}
        </div>
      </div>
    </section>
  )
}
