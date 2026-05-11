import { Card } from "@/components/ui"
import { cn } from "@/lib/cn"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import type { WhyChooseCardProps } from "./why-choose.types"

export function WhyChooseCard({ feature, index = 0 }: WhyChooseCardProps) {
  return (
    <Card
      shadow="sm"
      className={cn(
        "group w-[288px] h-[245px] mx-auto rounded-md border-border bg-card transition-all duration-300",
        "p-6 overflow-hidden",
        "hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)] transition-transform duration-300 group-hover:scale-105">
        <AnimatedIcon name={feature.icon} size={20} aria-hidden />
      </div>

      <h3 className="text-base font-bold leading-tight text-foreground">
        {feature.title}
      </h3>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
    </Card>
  )
}
