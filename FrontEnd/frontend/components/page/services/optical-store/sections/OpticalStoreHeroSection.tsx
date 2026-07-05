"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { Badge, Button, Input } from "@/components/ui"
import { OPTICAL_STORE_CONTENT } from "./optical-store.constants"

export function OpticalStoreHeroSection() {
  const { hero } = OPTICAL_STORE_CONTENT

  return (
    <section className="bg-background pt-8 pb-16 sm:pb-20 lg:pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-12 max-w-4xl"
        >
          <div className="relative">
            <AnimatedIcon
              name="search"
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="Search for frames, brands..."
              className="h-12 w-full rounded-md border-none bg-muted/50 pl-12 pr-6 focus-visible:ring-1 focus-visible:ring-[var(--destructive)]"
            />
          </div>
        </motion.div>

        {/* Hero Content */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl"
          >
            <Badge
              variant="muted"
              className="rounded-md bg-[var(--destructive)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--destructive)]"
            >
              {hero.badge}
            </Badge>

            <h1 className="mt-6 text-4xl font-bold leading-[1.15] text-foreground sm:text-5xl lg:text-6xl">
              {hero.title}
            </h1>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg lg:leading-loose">
              {hero.description}
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                variant="destructive"
                className="rounded-md px-10 font-bold h-12 text-sm uppercase tracking-wider"
              >
                {hero.primaryCTA.label}
              </Button>
              <Button
                variant="ghost"
                className="rounded-md bg-[var(--destructive)]/5 px-10 font-bold text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:opacity-100 h-12 text-sm uppercase tracking-wider transition-all"
              >
                {hero.secondaryCTA.label}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md shadow-[var(--shadow-2xl)]">
              <Image
                src={hero.image}
                alt="Premium designer eyewear collection"
                fill
                priority
                className="object-cover transition-transform duration-700 hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 700px"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
