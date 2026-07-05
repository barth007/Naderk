import Image from "next/image"
import { Badge } from "@/components/ui"
import { ABOUT_HERO_CONTENT } from "./about.constants"

export function AboutHeroSection() {
  return (
    <section className="bg-background py-10 sm:py-14 lg:py-16" aria-labelledby="about-hero-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Badge
            variant="muted"
            className="rounded-md bg-[var(--destructive)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--destructive)]"
          >
            {ABOUT_HERO_CONTENT.badge}
          </Badge>

          <h1
            id="about-hero-title"
            className="mt-6 text-2xl font-bold leading-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            {ABOUT_HERO_CONTENT.title}
          </h1>

          <p className="mx-auto mt-4 max-w-5xl text-xs leading-relaxed text-muted-foreground sm:text-sm lg:text-base">
            {ABOUT_HERO_CONTENT.description}
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl shadow-[var(--shadow-md)] sm:mt-10">
          <div className="relative h-[220px] w-full sm:h-[320px] lg:h-[390px]">
            <Image
              src={ABOUT_HERO_CONTENT.image}
              alt={ABOUT_HERO_CONTENT.imageAlt}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1200px"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
