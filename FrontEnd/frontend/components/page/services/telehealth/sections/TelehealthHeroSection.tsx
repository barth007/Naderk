"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Badge, Button } from "@/components/ui"
import { TELEHEALTH_CONTENT } from "./telehealth.constants"

export function TelehealthHeroSection() {
  const router = useRouter()
  const { hero } = TELEHEALTH_CONTENT

  return (
    <section className="relative bg-background py-16 sm:py-20 lg:py-24 overflow-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <Badge
              variant="muted"
              className="rounded-md bg-[var(--destructive)]/5 px-4 py-1.5 text-xs font-semibold text-[var(--destructive)]"
            >
              {hero.badge}
            </Badge>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-foreground sm:text-5xl">
              {hero.title}
            </h1>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
              {hero.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                variant="destructive"
                className="rounded-md px-8 font-semibold h-11"
                onClick={() => router.push(hero.primaryCTA.href)}
              >
                {hero.primaryCTA.label}
              </Button>
              <Button
                variant="ghost"
                className="rounded-md bg-[var(--destructive)]/5 px-8 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:opacity-100 h-11 transition-all"
                onClick={() => router.push(hero.secondaryCTA.href)}
              >
                {hero.secondaryCTA.label}
              </Button>
            </div>

            {/* Avatar Group / Social Proof */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3 overflow-hidden">
                {hero.avatars.map((avatar, i) => (
                  <div key={i} className="relative h-10 w-10 rounded-md border-2 border-background overflow-hidden bg-muted">
                    <Image src={avatar} alt={`Patient ${i + 1}`} fill sizes="40px" className="object-cover" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {hero.stats}
              </p>
            </div>
          </motion.div>

          {/* Right: Image with Status Overlay */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-[2rem] shadow-[var(--shadow-xl)]">
              <Image
                src={hero.image}
                alt="Virtual eye consultation in progress"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 600px"
              />

              {/* Doctor Status Overlay */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-3 rounded-md bg-black/40 backdrop-blur-md px-4 py-2.5 text-white shadow-lg">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-md h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <span className="text-xs font-bold tracking-widest uppercase">Doctor is Online</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
