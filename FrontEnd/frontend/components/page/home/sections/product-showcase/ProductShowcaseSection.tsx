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
  subtitle: string
  image: string
  price: number
  salePrice: number | null
}

const SHOP_HREF = "/dashboard/marketplace"
/** Below this many distinct items one row is enough; two rows would just repeat. */
const TWO_ROW_MIN = 8
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
        apiClient.get("/marketplace/products/", { params: { limit: 24 } })
          .then((r) => (r.data.data?.results ?? []) as Product[])
          .catch(() => [] as Product[]),
        apiClient.get("/marketplace/frames/")
          .then((r) => (r.data.data ?? []) as Frame[])
          .catch(() => [] as Frame[]),
      ])
      const items: Item[] = [
        ...frames.filter((f) => f.is_active).slice(0, 24).map((f) => ({
          key: `frame-${f.id}`,
          href: `/dashboard/marketplace/frame/${f.id}`,
          name: f.name,
          subtitle: [f.brand, f.style].filter(Boolean).join(" · "),
          image: f.front_image || f.images?.[0] || "",
          price: Number(f.base_price),
          salePrice: null,
        })),
        ...products.filter((p) => p.is_active).map((p) => ({
          key: `product-${p.id}`,
          href: `/dashboard/marketplace/product/${p.id}`,
          name: p.name,
          subtitle: p.category_name,
          image: p.images?.[0] || "",
          price: Number(p.price),
          salePrice: p.sale_price ? Number(p.sale_price) : null,
        })),
      ]
      // Pictures sell; anything without one only appears if nothing else does.
      const withImages = items.filter((i) => i.image)
      return shuffle(withImages.length >= 4 ? withImages : items)
    },
    staleTime: 5 * 60_000,
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
    <li className={cn("w-[200px] shrink-0 sm:w-[240px]", clone && "motion-reduce:hidden")} aria-hidden={clone || undefined}>
      <Link
        href={item.href}
        onClick={(e) => onOpen(e, item.href)}
        tabIndex={clone ? -1 : undefined}
        className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--destructive)]"
      >
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#F4F3F1]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- product images come from any storage host
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-gray-300" aria-hidden>
              <Glasses className="h-12 w-12" />
            </span>
          )}
          {onSale && (
            <span className="absolute left-3 top-3 rounded-full bg-[var(--destructive)] px-2.5 py-1 text-[11px] font-bold text-white">
              Sale
            </span>
          )}
          <span className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-white text-foreground opacity-0 shadow-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden>
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 px-1">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-[#B42318]">{item.name}</p>
          {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
          <p className="mt-1 text-sm font-bold text-foreground">
            {onSale ? (
              <>
                {naira(item.salePrice!)}{" "}
                <span className="text-xs font-medium text-muted-foreground line-through">{naira(item.price)}</span>
              </>
            ) : naira(item.price)}
          </p>
        </div>
      </Link>
    </li>
  )
}

function MarqueeRow({
  items, direction, onOpen,
}: {
  items: Item[]
  direction: "left" | "right"
  onOpen: (e: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  // Pad the row so one copy is wider than the screen, then render it twice:
  // the animation slides exactly one copy's width and loops without a seam.
  const row = useMemo(() => {
    const out: Item[] = []
    while (out.length < ROW_MIN) out.push(...items)
    return out
  }, [items])
  const style = { animationDuration: `${row.length * SECONDS_PER_CARD}s` } as CSSProperties

  return (
    <div className="group/row relative overflow-hidden motion-reduce:overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <ul
        style={style}
        className={cn(
          "flex w-max gap-5 py-2 sm:gap-6",
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

  const twoRows = items.length >= TWO_ROW_MIN
  const half = Math.ceil(items.length / 2)
  const rows: { items: Item[]; direction: "left" | "right" }[] = twoRows
    ? [{ items: items.slice(0, half), direction: "right" }, { items: items.slice(half), direction: "left" }]
    : [{ items, direction: "right" }]

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

      <div className="mt-10 flex flex-col gap-6">
        {isLoading ? (
          <div className="flex gap-5 overflow-hidden px-4" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[200px] shrink-0 sm:w-[240px]">
                <div className="aspect-square animate-pulse rounded-3xl bg-muted" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          rows.map((r, i) => <MarqueeRow key={i} items={r.items} direction={r.direction} onOpen={open} />)
        )}
      </div>
    </section>
  )
}
