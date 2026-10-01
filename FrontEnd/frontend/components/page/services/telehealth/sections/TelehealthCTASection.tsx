"use client"

import Link from "next/link"
import { Button } from "@/components/ui"
import { TELEHEALTH_CONTENT } from "./telehealth.constants"

export function TelehealthCTASection() {
  const { cta } = TELEHEALTH_CONTENT

  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {cta.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
          {cta.description}
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild variant="destructive" className="rounded-md px-8 font-semibold h-12">
            <Link href={cta.primaryCTA.href}>{cta.primaryCTA.label}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-md bg-[var(--destructive)]/5 px-8 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:opacity-100 h-12 transition-all"
          >
            <Link href={cta.secondaryCTA.href}>{cta.secondaryCTA.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
