"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Badge, Button } from "@/components/ui"
import { LABORATORY_CONTENT } from "./laboratory.constants"

export function LaboratoryHeroSection() {
  const router = useRouter()
  const { hero } = LABORATORY_CONTENT

  return (
    <section className="relative overflow-hidden bg-background py-16 sm:py-20 lg:py-24" aria-labelledby="lab-hero-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <div className="max-w-2xl">
            <Badge
              variant="muted"
              className="rounded-md bg-[var(--destructive)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--destructive)]"
            >
              {hero.badge}
            </Badge>

            <h1
              id="lab-hero-title"
              className="mt-6 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl"
            >
              {hero.title}
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
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
                className="rounded-md bg-[var(--destructive)]/10 px-8 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)] hover:opacity-100 h-11"
                onClick={() => router.push(hero.secondaryCTA.href)}
              >
                {hero.secondaryCTA.label}
              </Button>
            </div>
          </div>

          {/* Right: Image */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-[2.5rem] shadow-[var(--shadow-xl)]">
              <div className="relative h-[300px] w-full sm:h-[400px] lg:h-[500px]">
                <Image
                  src={hero.image}
                  alt={hero.imageAlt}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 600px"
                />
              </div>
            </div>
            
            {/* Subtle decorative element */}
            <div className="absolute -bottom-6 -right-6 -z-10 h-32 w-32 rounded-full bg-[var(--destructive)]/5 blur-2xl" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  )
}
