'use client'

import { useMemo, type CSSProperties, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Glasses } from "lucide-react"
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
    <li className={cn("w-[220px] shrink-0 sm:w-[260px] lg:w-[280px]", clone && "motion-reduce:hidden")} aria-hidden={clone || undefined}>
      <Link
        href={item.href}
        onClick={(e) => onOpen(e, item.href)}
        tabIndex={clone ? -1 : undefined}
        className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--destructive)] rounded-2xl"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#F3F1ED] transition-colors duration-500 group-hover:bg-[#EDEAE4]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              // multiply melts a photo's white backdrop into the tile.
              className="absolute inset-0 h-full w-full object-contain p-8 mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[#C9C4BA]" aria-hidden>
              <Glasses className="h-14 w-14" strokeWidth={1.25} />
            </span>
          )}
          {onSale && (
            <span className="absolute left-4 top-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B42318]">
              Sale
            </span>
          )}
          <span
            className="absolute inset-x-0 bottom-4 mx-auto flex w-max translate-y-3 items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            aria-hidden
          >
            View <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="mt-4 px-0.5">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{item.eyebrow}</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="truncate text-[15px] font-medium text-foreground">{item.name}</p>
            <p className="shrink-0 text-[15px] text-foreground tabular-nums">
              {onSale && <span className="mr-1.5 text-xs text-muted-foreground line-through">{naira(item.price)}</span>}
              <span className={cn(onSale && "text-[#B42318]")}>{naira(onSale ? item.salePrice! : item.price)}</span>
            </p>
          </div>
          {item.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>}
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
    <div className="group/row relative overflow-hidden motion-reduce:overflow-x-auto">
      <ul
        style={style}
        className={cn(
          "flex w-max gap-4 py-1 sm:gap-6",
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

      <div className="mt-12 flex flex-col gap-8 sm:gap-10">
        {isLoading ? (
          ROWS.map((_, r) => (
            <div key={r} className="flex gap-4 overflow-hidden sm:gap-6" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-[220px] shrink-0 sm:w-[260px] lg:w-[280px]">
                  <div className="aspect-[4/5] animate-pulse rounded-2xl bg-[#F3F1ED]" />
                  <div className="mt-4 h-2.5 w-1/4 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3.5 w-2/3 animate-pulse rounded bg-muted" />
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
