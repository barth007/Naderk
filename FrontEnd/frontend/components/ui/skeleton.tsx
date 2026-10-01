import { cn } from "@/lib/cn"
import type { HTMLAttributes } from "react"

/**
 * Placeholder block for `loading.tsx` route fallbacks.
 *
 * Kept dependency-free and server-renderable so Next.js can prerender it into
 * the prefetched shell — a Client Component here would defeat the point.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--muted)]", className)}
      {...props}
    />
  )
}
