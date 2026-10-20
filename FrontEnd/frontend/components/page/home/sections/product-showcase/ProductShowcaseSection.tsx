'use client'

import { useMemo, type CSSProperties, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, ArrowUpRight, Glasses } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { cn } from "@/lib/cn"
import { useAuth } from "@/hooks/useAuth"
import type { Frame, Product } from "@/services/marketplace/marketplace.types"

/**
 * A slow, endless strip of what the shop sells, for visitors on the home page.
 *
 * Browsing is open to everyone (the product and frame lists are public); only
 * opening an item needs an account, so a signed-out click goes to login and
 * comes back to that item afterwards.
 */

type Item = {
  key: string
  href: string
  name: string
  /** Small caps above the name: the frame's brand or the product's category. */
  eyebrow: string
  /** A quiet extra line, e.g. how many colours a frame comes in. */
  detail: string
  image: string
  price: number
  salePrice: number | null
}

const SHOP_HREF = "/dashboard/marketplace"
/** Three rows: alternating directions, each at its own pace so no two move together. */
const ROWS = [
  { direction: "right", pace: 1 },
  { direction: "left", pace: 1.3 },
  { direction: "right", pace: 0.8 },
] as const
/** With fewer distinct items than this, every row shows them all, each in its own order. */
const SPLIT_MIN = 12
/** Most distinct items drawn per visit: up to 20 per row, none shared between rows. */
const POOL_MAX = 60
/** Each row is repeated until it holds at least this many cards, so it always fills a wide screen. */
const ROW_MIN = 8
const SECONDS_PER_CARD = 6

const naira = (n: number) => `₦${n.toLocaleString()}`

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function useShowcaseItems() {
  return useQuery({
    queryKey: ["home-product-showcase"],
    queryFn: async (): Promise<Item[]> => {
      const [products, frames] = await Promise.all([
        // A random sample from the whole catalogue, drawn fresh by the server.
        apiClient.get("/marketplace/products/", { params: { sort_by: "random", limit: POOL_MAX } })
          .then((r) => (r.data.data?.results ?? []) as Product[])
          .catch(() => [] as Product[]),
        apiClient.get("/marketplace/frames/")
          .then((r) => (r.data.data ?? []) as Frame[])
          .catch(() => [] as Frame[]),
      ])
      const items: Item[] = [
        // Frames come back in full, so shuffle before picking, not after.
        ...shuffle(frames.filter((f) => f.is_active)).slice(0, POOL_MAX).map((f) => ({
          key: `frame-${f.id}`,
          href: `/dashboard/marketplace/frame/${f.id}`,
          name: f.name,
          eyebrow: f.brand || "Frame",
          detail: (() => {
            const colours = new Set((f.variants ?? []).map((v) => v.color).filter(Boolean)).size
            return colours > 1 ? `${colours} colours` : f.style || ""
          })(),
          image: f.front_image || f.images?.[0] || "",
          price: Number(f.base_price),
          salePrice: null,
        })),
        ...products.filter((p) => p.is_active).map((p) => ({
          key: `product-${p.id}`,
          href: `/dashboard/marketplace/product/${p.id}`,
          name: p.name,
          eyebrow: p.category_name || "Eye care",
          detail: "",
          image: p.images?.[0] || "",
          price: Number(p.price),
          salePrice: p.sale_price ? Number(p.sale_price) : null,
        })),
      ]
      // Pictures sell; anything without one only appears if nothing else does.
      const withImages = items.filter((i) => i.image)
      return shuffle(withImages.length >= 4 ? withImages : items).slice(0, POOL_MAX)
    },
    // A new draw on every visit to the page, but never mid-viewing.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** Card width; the trailing margin (not a flex gap) keeps the two loop copies exactly equal. */
const CARD_WIDTH = "w-[230px] sm:w-[250px] lg:w-[260px] mr-4 sm:mr-5"

function ShowcaseCard({
  item, onOpen, clone = false,
}: {
  item: Item
  onOpen: (e: MouseEvent<HTMLAnchorElement>, href: string) => void
  /** A copy that only closes the loop: clickable, but skipped by screen readers and Tab. */
  clone?: boolean
}) {
  const onSale = item.salePrice !== null && item.salePrice < item.price
  return (
    <li className={cn("shrink-0", CARD_WIDTH, clone && "motion-reduce:hidden")} aria-hidden={clone || undefined}>
      <Link
        href={item.href}
        onClick={(e) => onOpen(e, item.href)}
        tabIndex={clone ? -1 : undefined}
        className="group relative block overflow-hidden rounded-[28px] bg-[#0E0E13] p-2.5 shadow-[0_18px_40px_-18px_rgba(14,14,19,0.55)] ring-1 ring-white/10 transition-transform duration-500 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--destructive)]"
      >
        {/* Coloured light behind the glass. */}
        <span className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-[#E03E3E]/45 blur-3xl transition-opacity duration-500 group-hover:opacity-80" aria-hidden />
        <span className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-[#7C5CFF]/35 blur-3xl" aria-hidden />

        {/* Product on a lit pane. */}
        <div className="relative aspect-square overflow-hidden rounded-[22px] bg-gradient-to-b from-white to-[#ECE9F1]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              // multiply melts a photo's white backdrop into the pane.
              className="absolute inset-0 h-full w-full object-contain p-7 mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-[1.07] group-hover:-rotate-2"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[#B9B4C4]" aria-hidden>
              <Glasses className="h-14 w-14" strokeWidth={1.25} />
            </span>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3B3A44] backdrop-blur-sm">
            {item.eyebrow}
          </span>
          {onSale && (
            <span className="absolute right-3 top-3 rounded-full bg-[#E03E3E] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              Sale
            </span>
          )}
        </div>

        {/* Frosted info panel. */}
        <div className="relative mt-2.5 flex items-center gap-3 rounded-[20px] border border-white/15 bg-gradient-to-br from-white/[0.14] to-white/[0.04] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-sm tabular-nums">
              <span className={cn("font-semibold", onSale ? "text-[#FF8A8A]" : "text-white/90")}>
                {naira(onSale ? item.salePrice! : item.price)}
              </span>
              {onSale && <span className="text-xs text-white/40 line-through">{naira(item.price)}</span>}
              {!onSale && item.detail && <span className="truncate text-xs text-white/45">· {item.detail}</span>}
            </p>
          </div>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-all duration-300 group-hover:border-transparent group-hover:bg-white group-hover:text-[#0E0E13]"
            aria-hidden
          >
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </div>
      </Link>
    </li>
  )
}

function MarqueeRow({
  items, direction, pace = 1, onOpen,
}: {
  items: Item[]
  direction: "left" | "right"
  /** Seconds-per-card multiplier: above 1 is slower. */
  pace?: number
  onOpen: (e: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  // Pad the row so one copy is wider than the screen, then render it twice:
  // the animation slides exactly one copy's width and loops without a seam.
  // A short row is padded with reshuffled copies rather than the same
  // sequence again, never putting one item next to itself.
  const row = useMemo(() => {
    const out: Item[] = [...items]
    while (out.length < ROW_MIN && items.length > 0) {
      const next = shuffle(items)
      if (next.length > 1 && next[0].key === out[out.length - 1].key) [next[0], next[1]] = [next[1], next[0]]
      out.push(...next)
    }
    return out
  }, [items])
  const style = { animationDuration: `${row.length * SECONDS_PER_CARD * pace}s` } as CSSProperties

  return (
    <div className="group/row relative overflow-hidden rounded-[28px] motion-reduce:overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
      <ul
        style={style}
        className={cn(
          "flex w-max py-3",
          direction === "right" ? "animate-marquee-right" : "animate-marquee-left",
          "group-hover/row:[animation-play-state:paused] group-focus-within/row:[animation-play-state:paused]",
          "motion-reduce:animate-none",
        )}
      >
        {row.map((item, i) => <ShowcaseCard key={`a-${item.key}-${i}`} item={item} onOpen={onOpen} />)}
        {row.map((item, i) => <ShowcaseCard key={`b-${item.key}-${i}`} item={item} onOpen={onOpen} clone />)}
      </ul>
    </div>
  )
}

export function ProductShowcaseSection() {
  const router = useRouter()
  const isAuthenticated = useAuth((s) => s.isAuthenticated)
  const { data: items = [], isLoading } = useShowcaseItems()

  // Open to look at, account to open: a signed-out visitor goes to login,
  // which brings them back to this item.
  const open = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isAuthenticated) return
    e.preventDefault()
    toast.info("Log in to view this item", { description: "You'll come straight back to it afterwards." })
    router.push(`/login?next=${encodeURIComponent(href)}`)
  }

  if (!isLoading && items.length === 0) return null

  // Enough items: each row gets its own third. Too few: every row shows all of
  // them, started at a different point so the rows do not line up.
  const third = Math.ceil(items.length / ROWS.length)
  const rows = ROWS.map((r, i) => ({
    ...r,
    items: items.length >= SPLIT_MIN
      ? items.slice(i * third, (i + 1) * third)
      : [...items.slice((i * third) % items.length), ...items.slice(0, (i * third) % items.length)],
  }))

  return (
    <section aria-labelledby="showcase-heading" className="overflow-hidden bg-background py-16 sm:py-20">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--destructive)]">Shop eyewear</p>
          <h2 id="showcase-heading" className="mt-3 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Frames and eye care, ready when you are
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Browse what&rsquo;s in store. Pick something you like to see the details and order it.
          </p>
        </header>
        <Link
          href={SHOP_HREF}
          onClick={(e) => open(e, SHOP_HREF)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-[#F5C9C9] hover:text-[#B42318]"
        >
          Browse the shop <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* Inside the same centred, padded container as the rest of the page. */}
      <div className="mx-auto mt-12 flex w-full max-w-7xl flex-col gap-5 px-4 sm:gap-6 sm:px-6 lg:px-8">
        {isLoading ? (
          ROWS.map((_, r) => (
            <div key={r} className="flex overflow-hidden rounded-[28px] py-3" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={cn("shrink-0 rounded-[28px] bg-[#0E0E13] p-2.5", CARD_WIDTH)}>
                  <div className="aspect-square animate-pulse rounded-[22px] bg-white/10" />
                  <div className="mt-2.5 h-[68px] animate-pulse rounded-[20px] bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ))
        ) : (
          rows.map((r, i) => <MarqueeRow key={i} items={r.items} direction={r.direction} pace={r.pace} onOpen={open} />)
        )}
      </div>
    </section>
  )
}
