import { Card } from "@/components/ui"
import { cn } from "@/lib/cn"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import type { CorePillar } from "./about.types"

export function PillarCard({ pillar, index = 0 }: { pillar: CorePillar; index?: number }) {
  return (
    <Card
      shadow="none"
      className={cn(
        "group flex flex-col items-center text-center rounded-2xl border-none bg-card transition-all duration-300",
        "px-6 py-10",
        "hover:bg-muted/30"
      )}
    >
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)] transition-transform duration-300 group-hover:scale-105">
        <AnimatedIcon name={pillar.icon} size={24} aria-hidden />
      </div>

      <h3 className="text-base font-bold leading-tight text-foreground">
        {pillar.title}
      </h3>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground max-w-[280px]">
        {pillar.description}
      </p>
    </Card>
  )
}
