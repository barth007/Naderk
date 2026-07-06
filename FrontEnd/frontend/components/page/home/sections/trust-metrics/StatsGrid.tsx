'use client'

import { useTrustMetrics } from '@/services/cms/admin-cms.hooks'
import { StatCard } from "./StatCard"
import { TRUST_METRICS_CONTENT } from "./trust-metrics.constants"

export function StatsGrid() {
  const { data: apiMetrics } = useTrustMetrics();
  const stats = apiMetrics && apiMetrics.length > 0
    ? apiMetrics.map(m => ({ value: m.value, label: m.label, description: '' }))
    : TRUST_METRICS_CONTENT.stats;

  return (
    <div className="grid grid-cols-2 gap-4 lg:gap-6">
      {stats.map((stat, i) => (
        <StatCard key={i} stat={stat} />
      ))}
    </div>
  )
}
