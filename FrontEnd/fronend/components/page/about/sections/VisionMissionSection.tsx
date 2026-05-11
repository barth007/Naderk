import Image from "next/image"
import { Card } from "@/components/ui"
import { VISION_MISSION_CONTENT } from "./about.constants"

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card className="h-full rounded-xl border-border bg-card px-5 py-4" shadow="none">
      <p className="text-3xl font-bold leading-none text-[var(--destructive)]">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </Card>
  )
}

export function VisionMissionSection() {
  const content = VISION_MISSION_CONTENT

  return (
    <section className="bg-background py-10 sm:py-14 lg:py-16" aria-labelledby="vision-mission-title">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-10 lg:px-8">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--destructive)]">
            <span className="h-px w-7 bg-[var(--destructive)]" aria-hidden />
            {content.label}
          </p>

          <div className="mt-4 space-y-6">
            <article>
              <h2 id="vision-mission-title" className="text-2xl font-bold text-foreground sm:text-3xl">
                {content.vision.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {content.vision.description}
              </p>
            </article>

            <article>
              <h3 className="text-2xl font-bold text-foreground sm:text-3xl">{content.mission.title}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {content.mission.description}
              </p>
            </article>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {content.stats.map((stat) => (
              <StatCard key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-md)]">
          <div className="relative h-[320px] w-full sm:h-[480px] lg:h-[640px]">
            <Image
              src={content.image}
              alt={content.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 540px"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
