'use client'

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * An endless, full-width product carousel that glides on its own and can also
 * be driven by hand: arrows, swipe, trackpad. Gliding pauses while the pointer
 * is over it, while it holds focus, for a moment after someone scrolls it, and
 * entirely for visitors who ask for reduced motion.
 *
 * The items are rendered twice; scrolling past one copy jumps back by exactly
 * one copy's width, which looks the same, so it never runs out.
 */

/** Gliding speed, px per second. */
const SPEED = 40
/** How long gliding waits after someone scrolls it themselves. */
const RESUME_AFTER_MS = 2500
/** Repeat short lists until one copy holds at least this many, so it always overflows a wide screen. */
const MIN_PER_COPY = 10

/** Hold off gliding for a while after a person moves the carousel. */
const pauseUntil = () => performance.now() + RESUME_AFTER_MS

export function ProductCarousel<T>({
  items, itemKey, renderItem, label,
}: {
  items: T[]
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  label: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const firstCopy = useRef<HTMLUListElement>(null)
  const pos = useRef(0)
  const hovered = useRef(false)
  const focused = useRef(false)
  const resumeAt = useRef(0)

  const row = useMemo(() => {
    const out: T[] = [...items]
    while (out.length < MIN_PER_COPY && items.length > 0) out.push(...items)
    return out
  }, [items])

  // Keep the copy that only closes the loop out of the Tab order and away
  // from screen readers; it stays clickable, being half of what is on screen.
  useEffect(() => {
    scroller.current?.querySelectorAll<HTMLElement>("[data-loop-copy] a, [data-loop-copy] button")
      .forEach((el) => { el.tabIndex = -1 })
  }, [row])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    pos.current = 0
    el.scrollLeft = 0
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const copyWidth = () => firstCopy.current?.offsetWidth ?? 0

    // Wrap into the middle range so both directions can keep going.
    const wrap = () => {
      const w = copyWidth()
      if (!w) return
      if (el.scrollLeft >= w) el.scrollLeft -= w
      else if (el.scrollLeft <= 0 && pos.current > 0) el.scrollLeft += w
    }

    const onScroll = () => {
      // A jump bigger than our own step means a person scrolled it.
      if (Math.abs(el.scrollLeft - pos.current) > 2) {
        resumeAt.current = pauseUntil()
      }
      wrap()
      pos.current = el.scrollLeft
    }
    el.addEventListener("scroll", onScroll, { passive: true })

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64)
      last = now
      const paused = reduceMotion || hovered.current || focused.current || now < resumeAt.current
        || document.hidden
      if (!paused && copyWidth() > el.clientWidth) {
        pos.current += (SPEED * dt) / 1000
        if (pos.current >= copyWidth()) pos.current -= copyWidth()
        el.scrollLeft = pos.current
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener("scroll", onScroll)
    }
  }, [row])

  const nudge = (dir: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    resumeAt.current = pauseUntil()
    // Before going left from the very start, step into the second copy so there is room.
    if (dir === -1 && el.scrollLeft < 10) {
      el.scrollLeft += firstCopy.current?.offsetWidth ?? 0
      pos.current = el.scrollLeft
    }
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.6, 260), behavior: "smooth" })
  }

  return (
    <div
      className="group/carousel relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") hovered.current = true }}
      onPointerLeave={() => { hovered.current = false }}
      onFocus={() => { focused.current = true }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) focused.current = false }}
    >
      <div ref={scroller} className="no-scrollbar flex overflow-x-auto py-2">
        <ul ref={firstCopy} className="flex shrink-0">
          {row.map((item, i) => (
            <li key={`a-${itemKey(item)}-${i}`} className="mr-4 flex w-[240px] shrink-0 sm:mr-5">{renderItem(item)}</li>
          ))}
        </ul>
        <ul className="flex shrink-0" aria-hidden data-loop-copy>
          {row.map((item, i) => (
            <li key={`b-${itemKey(item)}-${i}`} className="mr-4 flex w-[240px] shrink-0 sm:mr-5">{renderItem(item)}</li>
          ))}
        </ul>
      </div>

      {/* Arrows: always on touch screens, on hover or focus with a mouse. */}
      {[-1, 1].map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => nudge(dir as 1 | -1)}
          aria-label={dir === -1 ? "Previous products" : "Next products"}
          className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md backdrop-blur transition-opacity hover:text-[#B42318] focus-visible:opacity-100 sm:opacity-0 sm:group-hover/carousel:opacity-100 sm:group-focus-within/carousel:opacity-100 ${dir === -1 ? "left-3 sm:left-5" : "right-3 sm:right-5"}`}
        >
          {dir === -1 ? <ChevronLeft className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
        </button>
      ))}
    </div>
  )
}
