"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { TRUST_METRICS_CONTENT } from "./trust-metrics.constants"
import { cn } from "@/lib/cn"

export function ClientMarquee() {
  const { clientsRow1, clientsRow2 } = TRUST_METRICS_CONTENT

  return (
    <div className="flex flex-col gap-12 lg:gap-16 py-12">
      {/* Row 1: Right to Left */}
      <div className="group relative flex overflow-hidden">
        {/* Row Container */}
        <div className="flex animate-marquee-left gap-16 lg:gap-24 pr-16 lg:pr-24 group-hover:[animation-play-state:paused]">
          {[...clientsRow1, ...clientsRow1].map((client, i) => (
            <LogoItem key={`row1-${i}`} client={client} />
          ))}
        </div>
        
        {/* Left/Right Edge Masks */}
        <div className="absolute inset-y-0 left-0 w-24 md:w-64 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 md:w-64 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
      </div>

      {/* Row 2: Left to Right */}
      <div className="group relative flex overflow-hidden">
        {/* Row Container */}
        <div className="flex animate-marquee-right gap-16 lg:gap-24 pr-16 lg:pr-24 group-hover:[animation-play-state:paused] [animation-duration:80s]">
          {[...clientsRow2, ...clientsRow2].map((client, i) => (
            <LogoItem key={`row2-${i}`} client={client} />
          ))}
        </div>
        
        {/* Left/Right Edge Masks */}
        <div className="absolute inset-y-0 left-0 w-24 md:w-64 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 md:w-64 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  )
}

function LogoItem({ client }: { client: typeof TRUST_METRICS_CONTENT.clientsRow1[0] }) {
  return (
    <div className="relative h-12 w-28 lg:h-14 lg:w-36 shrink-0 flex items-center justify-center group/logo transition-all duration-700">
      <motion.div
        whileHover={{ scale: 1.15 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-full grayscale opacity-40 contrast-[0.8] hover:grayscale-0 hover:opacity-100 hover:contrast-100 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <Image
          src={client.logo}
          alt={client.name}
          fill
          className="object-contain"
          unoptimized
        />
      </motion.div>
    </div>
  )
}
