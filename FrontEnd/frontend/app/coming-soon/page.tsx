import Link from "next/link"
import { Button, Badge } from "@/components/ui"

export const metadata = {
  title: "Coming Soon - NaderkEye",
  description: "This page is currently under development.",
}

export default function ComingSoonPage() {
  return (
    <main className="bg-background">
      <section className="mx-auto flex min-h-[calc(100svh-72px)] w-full max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl text-center">
          <Badge
            variant="muted"
            className="rounded-md bg-[var(--destructive)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--destructive)]"
          >
            Page Update
          </Badge>

          <h1 className="mt-6 text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Coming Soon
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            We are currently building this page to give you a better experience. Please check back soon.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="destructive" className="w-full rounded-md px-8 font-semibold sm:w-auto">
                Back to Home
              </Button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                className="w-full rounded-md bg-[var(--destructive)]/10 px-8 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)] hover:opacity-100 sm:w-auto"
              >
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
