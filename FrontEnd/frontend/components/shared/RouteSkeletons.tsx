import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared fallbacks for the `loading.tsx` route boundaries.
 *
 * Beyond the visible feedback, these boundaries are what make dynamic routes
 * prefetchable at all: Next.js only prefetches a dynamic page when the segment
 * has a `loading` file to prerender down to. Without them every link click was
 * a cold, unannounced server roundtrip.
 */

/** Content-area fallback for the authenticated portals (sits inside the dashboard shell). */
export function PortalContentSkeleton() {
  return (
    <div className="w-full space-y-6" role="status" aria-label="Loading page">
      {/* Page heading */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** Fallback for the public marketing pages (sits between the navbar and footer). */
export function PublicPageSkeleton() {
  return (
    <div className="w-full" role="status" aria-label="Loading page">
      {/* Hero band */}
      <div className="w-full bg-[var(--muted)]/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 space-y-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-full max-w-2xl" />
          <Skeleton className="h-12 w-3/4 max-w-xl" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-12 w-44 rounded-md" />
        </div>
      </div>

      {/* Content band */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-40 w-full rounded-[var(--radius-md)]" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** Fallback for the standalone form screens (auth, onboarding, complete-profile). */
export function CenteredFormSkeleton() {
  return (
    <div
      className="w-full flex items-center justify-center p-4"
      role="status"
      aria-label="Loading page"
    >
      <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
