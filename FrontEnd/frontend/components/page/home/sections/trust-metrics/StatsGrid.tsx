import { StatCard } from "./StatCard"
import { TRUST_METRICS_CONTENT } from "./trust-metrics.constants"

export function StatsGrid() {
  const { stats } = TRUST_METRICS_CONTENT

  return (
    <div className="grid grid-cols-2 gap-4 lg:gap-6">
      {stats.map((stat, i) => (
        <StatCard key={i} stat={stat} />
      ))}
    </div>
  )
}
