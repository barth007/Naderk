"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"
import { LABORATORY_CONTENT } from "./laboratory.constants"

export function ResultsPortalCTASection() {
  const router = useRouter()
  const { portal } = LABORATORY_CONTENT

  return (
    <section className="bg-[var(--destructive)] py-16 sm:py-20 lg:py-24 text-white text-center">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {portal.title}
        </h2>
        <p className="mt-4 text-base leading-relaxed opacity-90 sm:text-lg">
          {portal.description}
        </p>
        <div className="mt-10">
          <Button
            variant="ghost"
            className="h-12 rounded-lg bg-white px-8 font-semibold text-[var(--destructive)] hover:bg-gray-50 hover:text-[var(--destructive)] hover:opacity-100 transition-colors"
            onClick={() => router.push(portal.href)}
          >
            {portal.buttonLabel}
          </Button>
        </div>
      </div>
    </section>
  )
}
