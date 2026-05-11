"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Badge, Button } from "@/components/ui"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { HERO_CONTENT } from "./hero.constants"
import { ShowcaseWindow } from "./ShowcaseWindow"
import { cn } from "@/lib/cn"

export function HeroSection() {
  const router = useRouter()
  const { badge, title, description, ctas, trust } = HERO_CONTENT

  return (
    <section 
      className="relative min-h-screen bg-white overflow-hidden pt-24 pb-32"
      aria-label="NaderkEye Innovation Hero"
    >
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 h-[800px] w-[800px] bg-[#E53E3E]/[0.03] blur-[150px]" />
        <div className="absolute bottom-0 left-0 h-[600px] w-[600px] bg-blue-500/[0.02] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12 lg:gap-20">
          
          {/* Top Block: Messaging + Trust */}
          <div className="flex flex-col lg:flex-row items-start justify-between gap-12 lg:gap-24">
            
            {/* Left: Messaging */}
            <div className="flex-1 space-y-8 lg:space-y-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge 
                  variant="muted" 
                  className="h-9 rounded-full bg-slate-100 border border-slate-200 px-5 text-xs font-bold uppercase tracking-widest text-[#E53E3E] backdrop-blur-md"
                >
                  <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#E53E3E] animate-pulse" />
                  {badge}
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-8xl lg:text-[6.5rem] font-black leading-[0.95] tracking-tight text-slate-900"
              >
                {title.first} <br />
                <span className="text-[#E53E3E]">{title.highlight}</span> <br />
                <span className="text-slate-800">{title.second}</span>
              </motion.h1>

              <div className="flex flex-col md:flex-row items-start md:items-end gap-10 lg:gap-12 pt-4">
                 <motion.p
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.6, delay: 0.2 }}
                   className="max-w-xl text-base md:text-xl text-slate-500 leading-relaxed font-medium"
                 >
                   {description}
                 </motion.p>

                 {/* Trust Metrics - Integrated into flow */}
                 <motion.div
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ duration: 0.6, delay: 0.3 }}
                   className="flex flex-col gap-4 min-w-[280px]"
                 >
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Trusted by 50,000+ patients</span>
                    <div className="flex items-center gap-4">
                       <div className="flex -space-x-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                             <div key={i} className="h-10 w-10 rounded-full border-2 border-white bg-slate-100 overflow-hidden relative shadow-sm">
                                <Image 
                                   src={`https://i.pravatar.cc/100?img=${i + 15}`} 
                                   alt="Patient" 
                                   fill 
                                    sizes="40px"
                                   className="object-cover" 
                                />
                             </div>
                          ))}
                       </div>
                       <div className="flex gap-1 text-[#FEBC2E]">
                          {[1, 2, 3, 4, 5].map((i) => (
                             <AnimatedIcon key={i} name="star" size={14} className="fill-current" />
                          ))}
                       </div>
                    </div>
                 </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center gap-4 pt-6"
              >
                <Button
                  variant="destructive"
                  size="md"
                  className="w-full sm:w-auto rounded-md px-5 font-semibold"
                  onClick={() => router.push(ctas.primary.href)}
                >
                  {ctas.primary.label}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full sm:w-auto rounded-md px-5 font-semibold bg-[#fde8ec] text-[var(--destructive)] hover:bg-[#fbd1d9] border-0 hover:opacity-100"
                  onClick={() => router.push(ctas.secondary.href)}
                >
                  {ctas.secondary.label}
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Bottom Block: Showcase Window */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <ShowcaseWindow />
          </motion.div>

        </div>
      </div>
    </section>
  )
}
