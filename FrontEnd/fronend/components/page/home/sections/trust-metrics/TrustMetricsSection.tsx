"use client"

import { motion } from "framer-motion"
import { ClientMarquee } from "./ClientMarquee"
import { StatsGrid } from "./StatsGrid"
import { TRUST_METRICS_CONTENT } from "./trust-metrics.constants"

export function TrustMetricsSection() {
  const { heading } = TRUST_METRICS_CONTENT

  return (
    <section className="bg-white py-24 lg:py-32 overflow-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
          
          {/* Left: Cinematic Marquee (Col 7) */}
          <div className="lg:col-span-7 flex flex-col gap-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                {heading}
              </h2>
              <div className="h-[1px] w-12 bg-slate-200" />
            </motion.div>
            
            <div className="w-full">
              <ClientMarquee />
            </div>
          </div>

          {/* Right: Stats Grid (Col 5) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5 w-full"
          >
            <StatsGrid />
          </motion.div>

        </div>
      </div>
    </section>
  )
}
