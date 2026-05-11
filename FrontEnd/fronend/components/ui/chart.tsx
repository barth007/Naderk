import { cn } from "@/lib/cn"
import type { HTMLAttributes } from "react"

/*
  Chart color integration:
  All five chart colors are exposed as CSS variables:
    --chart-1 … --chart-5

  These map to Tailwind utility classes via @theme inline:
    text-chart-1, bg-chart-1, fill-chart-1, stroke-chart-1 (etc.)

  For third-party chart libraries (Recharts, Chart.js, Nivo):
    import { tokens } from "@/lib/tokens"
    colors: tokens.chartPalette
    // → ["var(--chart-1)", "var(--chart-2)", …]

  This file provides:
  1. ChartCard  — reusable container for any chart
  2. ChartLegend — color-dot legend using token classes
  3. MiniBar    — pure-CSS bar chart demo (no library required)
*/

// ── Chart Card ───────────────────────────────────────────────

export interface ChartCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  legend?: Array<{ label: string; color: 1 | 2 | 3 | 4 | 5 }>
}

export function ChartCard({
  title,
  description,
  legend,
  className,
  children,
  ...props
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "card bg-card text-card-foreground",
        "border border-border rounded-[var(--radius-lg)]",
        "shadow-[var(--shadow-sm)] p-0 overflow-hidden",
        className
      )}
      {...props}
    >
      {(title || description) && (
        <div className="px-6 pt-5 pb-3 border-b border-border">
          {title && (
            <h3 className="text-base font-semibold text-card-foreground">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      )}

      <div className="px-6 py-5">{children}</div>

      {legend && legend.length > 0 && (
        <div className="px-6 pb-5 -mt-2">
          <ChartLegend items={legend} />
        </div>
      )}
    </div>
  )
}

// ── Chart Legend ─────────────────────────────────────────────

type ChartLegendItem = { label: string; color: 1 | 2 | 3 | 4 | 5 }

const colorClassMap: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
}

export function ChartLegend({
  items,
  className,
}: {
  items: ChartLegendItem[]
  className?: string
}) {
  return (
    <ul
      className={cn("flex flex-wrap gap-x-5 gap-y-2", className)}
      role="list"
    >
      {items.map(({ label, color }) => (
        <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={cn("h-2.5 w-2.5 rounded-full shrink-0", colorClassMap[color])}
            aria-hidden="true"
          />
          {label}
        </li>
      ))}
    </ul>
  )
}

// ── Mini Bar Chart (pure CSS, no library) ────────────────────
/*
  Demonstrates chart token colors in action.
  Replace with Recharts / Chart.js for production charts.
*/

export interface MiniBarChartProps {
  data: Array<{ label: string; value: number; color?: 1 | 2 | 3 | 4 | 5 }>
  maxValue?: number
  height?: number
  className?: string
}

export function MiniBarChart({
  data,
  maxValue,
  height = 140,
  className,
}: MiniBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)

  const barColorVars: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "var(--chart-1)",
    2: "var(--chart-2)",
    3: "var(--chart-3)",
    4: "var(--chart-4)",
    5: "var(--chart-5)",
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex items-end justify-between gap-2"
        style={{ height }}
        role="img"
        aria-label="Bar chart"
      >
        {data.map(({ label, value, color = 1 }, i) => {
          const heightPct = Math.max((value / max) * 100, 2)
          return (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-1.5"
            >
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {value.toLocaleString()}
              </span>
              <div
                className="w-full rounded-t-[var(--radius-sm)] transition-all duration-500"
                style={{
                  height: `calc(${heightPct}% - 1.25rem)`,
                  backgroundColor: barColorVars[color ?? ((i % 5) + 1 as 1 | 2 | 3 | 4 | 5)],
                }}
                role="presentation"
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between gap-2 mt-2 border-t border-border pt-2">
        {data.map(({ label }) => (
          <span
            key={label}
            className="flex-1 text-center text-xs text-muted-foreground truncate"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────

export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  trend?: { value: number; label?: string }
  accentColor?: 1 | 2 | 3 | 4 | 5
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  trend,
  accentColor = 1,
  className,
}: StatCardProps) {
  const isPositive = (trend?.value ?? 0) >= 0
  const accentVar = `var(--chart-${accentColor})`

  return (
    <div
      className={cn(
        "card bg-card text-card-foreground",
        "border border-border rounded-[var(--radius-lg)]",
        "shadow-[var(--shadow-sm)] p-5",
        className
      )}
    >
      <div
        className="h-1 w-10 rounded-full mb-4"
        style={{ backgroundColor: accentVar }}
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "text-xs font-medium mt-2",
            isPositive ? "text-[var(--color-success,oklch(0.65_0.15_160))]" : "text-destructive"
          )}
        >
          {isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          {trend.label && <span className="text-muted-foreground font-normal ml-1">{trend.label}</span>}
        </p>
      )}
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}

/* ── Usage examples ────────────────────────────────────────────
  // Stat cards
  <StatCard title="Total Revenue" value="$48,295" trend={{ value: 12.5, label: "vs last month" }} accentColor={1} />
  <StatCard title="Active Users" value="2,841" trend={{ value: -3.2, label: "vs last week" }} accentColor={2} />

  // Chart card with MiniBarChart
  <ChartCard
    title="Monthly Sales"
    description="Jan – Jun 2025"
    legend={[
      { label: "Product A", color: 1 },
      { label: "Product B", color: 2 },
    ]}
  >
    <MiniBarChart
      data={[
        { label: "Jan", value: 4200, color: 1 },
        { label: "Feb", value: 5800, color: 1 },
        { label: "Mar", value: 3900, color: 2 },
        { label: "Apr", value: 7100, color: 1 },
        { label: "May", value: 6200, color: 2 },
        { label: "Jun", value: 8400, color: 1 },
      ]}
    />
  </ChartCard>

  // With Recharts (production example):
  import { tokens } from "@/lib/tokens"
  <BarChart>
    <Bar dataKey="revenue" fill={tokens.chart1} />
    <Bar dataKey="cost"    fill={tokens.chart2} />
  </BarChart>
──────────────────────────────────────────────────────────────── */
