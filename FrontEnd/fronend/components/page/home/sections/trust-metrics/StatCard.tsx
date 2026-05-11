"use client"

import { useEffect, useRef } from "react"
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Card } from "@/components/ui"
import type { TrustStat } from "./trust-metrics.types"

function AnimatedNumber({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  
  // Parse numeric part and suffix
  const numericMatch = value.match(/(\d+)/)
  const numericValue = numericMatch ? parseInt(numericMatch[0]) : 0
  const suffix = value.replace(/\d+/, "")

  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
  })
  const displayValue = useTransform(springValue, (latest) => Math.round(latest))

  useEffect(() => {
    if (isInView) {
      motionValue.set(numericValue)
    }
  }, [isInView, numericValue, motionValue])

  return (
    <span ref={ref} className="text-3xl lg:text-4xl font-bold tracking-tight text-[var(--destructive)]">
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  )
}

export function StatCard({ stat }: { stat: TrustStat }) {
  return (
    <Card className="flex flex-col p-6 lg:p-8 rounded-[2rem] border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]">
      <AnimatedNumber value={stat.value} />
      <span className="mt-2 text-sm font-bold text-foreground">
        {stat.label}
      </span>
      {stat.description && (
        <span className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {stat.description}
        </span>
      )}
    </Card>
  )
}
