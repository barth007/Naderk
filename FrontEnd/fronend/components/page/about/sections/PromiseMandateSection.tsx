"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"
import { PROMISE_MANDATE_CONTENT } from "./about.constants"

export function PromiseMandateSection() {
  const router = useRouter()

  return (
    <section className="bg-background py-12 sm:py-14 lg:py-16" aria-labelledby="promise-mandate-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 id="promise-mandate-title" className="text-2xl font-bold text-foreground sm:text-3xl">
            {PROMISE_MANDATE_CONTENT.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {PROMISE_MANDATE_CONTENT.description}
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              variant="destructive"
              className="rounded-md px-8 font-semibold"
              onClick={() => router.push(PROMISE_MANDATE_CONTENT.primaryCTA.href)}
            >
              {PROMISE_MANDATE_CONTENT.primaryCTA.label}
            </Button>
            <Button
              variant="ghost"
              className="rounded-md bg-[var(--destructive)]/10 px-8 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)] hover:opacity-100"
              onClick={() => router.push(PROMISE_MANDATE_CONTENT.secondaryCTA.href)}
            >
              {PROMISE_MANDATE_CONTENT.secondaryCTA.label}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
