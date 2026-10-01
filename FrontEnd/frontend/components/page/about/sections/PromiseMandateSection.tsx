"use client"

import Link from "next/link"
import { Button } from "@/components/ui"
import { useAboutContent } from "../useAboutContent"

export function PromiseMandateSection() {
  const content = useAboutContent()

  return (
    <section className="bg-background py-12 sm:py-14 lg:py-16" aria-labelledby="promise-mandate-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 id="promise-mandate-title" className="text-2xl font-bold text-foreground sm:text-3xl">
            {content.promise.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {content.promise.description}
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="destructive" className="rounded-md px-8 font-semibold">
              <Link href={content.promise.primaryCTA.href}>
                {content.promise.primaryCTA.label}
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-md bg-[var(--destructive)]/10 px-8 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)] hover:opacity-100"
            >
              <Link href={content.promise.secondaryCTA.href}>
                {content.promise.secondaryCTA.label}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
