"use client"

import { useLinkStatus } from "next/link"
import { cn } from "@/lib/cn"

/**
 * Inline "this navigation is in flight" hint. Must be rendered inside a <Link>.
 *
 * Next skips the pending state entirely when the destination was prefetched,
 * so this only appears when a navigation genuinely has to wait — which is the
 * case that used to look like a dead click.
 *
 * The dot is always in the layout and only its opacity animates, so showing it
 * cannot shift the surrounding text.
 */
export function LinkPendingDot({ className }: { className?: string }) {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden
      className={cn(
        "ml-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current",
        "transition-opacity duration-150",
        pending ? "opacity-70 animate-pulse" : "opacity-0",
        className
      )}
    />
  )
}
