'use client'

import { useEffect, useMemo, useRef, type CSSProperties, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { cn } from "@/lib/cn"
import { useAuth } from "@/hooks/useAuth"
import ProductCard from "@/components/marketplace/ProductCard"
import FrameCard from "@/components/marketplace/FrameCard"
import { useAddToCart, useToggleWishlist, useWishlist } from "@/services/marketplace/marketplace.hooks"
import type { Frame, Product } from "@/services/marketplace/marketplace.types"

/**
 * A slow, endless strip of what the shop sells, for visitors on the home page,
 * using the same cards as the shop itself.
 *
 * Browsing is open to everyone (the product and frame lists are public). Any
 * click on a card needs an account, so a signed-out click goes to login and
 * comes back to that item afterwards.
 */

type Item =
  | { kind: "product"; key: string; href: string; image: string; product: Product }
  | { kind: "frame"; key: string; href: string; image: string; frame: Frame }

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
/** Spacing after each card. A margin rather than a flex gap keeps the two loop copies exactly equal. */
const CARD_SPACING = "mr-4 sm:mr-5"

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
        ...shuffle(frames.filter((f) => f.is_active)).slice(0, POOL_MAX).map((frame): Item => ({
          kind: "frame",
          key: `frame-${frame.id}`,
          href: `/dashboard/marketplace/frame/${frame.id}`,
          image: frame.front_image || frame.images?.[0] || "",
          frame,
        })),
        ...products.filter((p) => p.is_active).map((product): Item => ({
          kind: "product",
          key: `product-${product.id}`,
          href: `/dashboard/marketplace/product/${product.id}`,
          image: product.images?.[0] || "",
          product,
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

type CardActions = {
  isAuthenticated: boolean
  toLogin: (href: string) => void
  inWishlist: (productId: string) => boolean
  onToggleWishlist: (id: string, e: MouseEvent) => void
  onAddToCart: (product: Product, e: MouseEvent) => void
  isAddingToCart: boolean
}

function ShowcaseItem({ item, actions, clone = false }: { item: Item; actions: CardActions; clone?: boolean }) {
  const ref = useRef<HTMLLIElement>(null)

  // A loop copy stays clickable (it is half of what is on screen) but is kept
  // out of the Tab order, so keyboard users meet each card once.
  useEffect(() => {
    if (!clone) return
    ref.current?.querySelectorAll<HTMLElement>("a, button").forEach((el) => { el.tabIndex = -1 })
  }, [clone])

  return (
    <li
      ref={ref}
      aria-hidden={clone || undefined}
      className={cn("flex shrink-0", CARD_SPACING, clone && "motion-reduce:hidden")}
      // Signed out, every click on a card (open, wishlist, add to cart) asks
      // for an account first, then returns to this item.
      onClickCapture={(e) => {
        if (actions.isAuthenticated) return
        e.preventDefault()
        e.stopPropagation()
        actions.toLogin(item.href)
      }}
    >
      {item.kind === "frame" ? (
        <FrameCard frame={item.frame} fixedWidth />
      ) : (
        <ProductCard
          product={item.product}
          fixedWidth
          inWishlist={actions.inWishlist(item.product.id)}
          onToggleWishlist={actions.onToggleWishlist}
          onAddToCart={actions.onAddToCart}
          isAddingToCart={actions.isAddingToCart}
        />
      )}
    </li>
  )
}

function MarqueeRow({
  items, direction, pace = 1, actions,
}: {
  items: Item[]
  direction: "left" | "right"
  /** Seconds-per-card multiplier: above 1 is slower. */
  pace?: number
  actions: CardActions
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
          // items-stretch keeps every card in a row the same height.
          "flex w-max items-stretch py-2",
          direction === "right" ? "animate-marquee-right" : "animate-marquee-left",
          "group-hover/row:[animation-play-state:paused] group-focus-within/row:[animation-play-state:paused]",
          "motion-reduce:animate-none",
        )}
      >
        {row.map((item, i) => <ShowcaseItem key={`a-${item.key}-${i}`} item={item} actions={actions} />)}
        {row.map((item, i) => <ShowcaseItem key={`b-${item.key}-${i}`} item={item} actions={actions} clone />)}
      </ul>
    </div>
  )
}

export function ProductShowcaseSection() {
  const router = useRouter()
  const isAuthenticated = useAuth((s) => s.isAuthenticated)
  const { data: items = [], isLoading } = useShowcaseItems()
  const { data: wishlist } = useWishlist(isAuthenticated)
  const toggleWishlist = useToggleWishlist()
  const addToCart = useAddToCart()

  const toLogin = (href: string) => {
    toast.info("Log in to continue", { description: "You'll come straight back to this item afterwards." })
    router.push(`/login?next=${encodeURIComponent(href)}`)
  }

  // Same behaviour as the shop's own cards.
  const inWishlist = (id: string) => wishlist?.items?.some((w) => w.product === id) ?? false
  const actions: CardActions = {
    isAuthenticated,
    toLogin,
    inWishlist,
    isAddingToCart: addToCart.isPending,
    onToggleWishlist: (productId, e) => {
      e.preventDefault()
      e.stopPropagation()
      const wasSaved = inWishlist(productId)
      toggleWishlist.mutate({ product_id: productId }, {
        onSuccess: () => toast.success(wasSaved ? "Removed from wishlist" : "Added to wishlist"),
        onError: () => toast.error("Could not update your wishlist."),
      })
    },
    onAddToCart: (product, e) => {
      e.preventDefault()
      e.stopPropagation()
      addToCart.mutate({
        product_id: product.id,
        product_variant_id: product.variants?.[0]?.id ?? null,
        quantity: 1,
      }, {
        onSuccess: () => toast.success(`${product.name} added to cart`),
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          toast.error(detail ?? "Could not add item to cart.")
        },
      })
    },
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
          onClick={(e) => { if (!isAuthenticated) { e.preventDefault(); toLogin(SHOP_HREF) } }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-[#F5C9C9] hover:text-[#B42318]"
        >
          Browse the shop <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* A little wider than the text above, with a slim gutter, so the strip
          reads as part of the page without being boxed in. */}
      <div className="mx-auto mt-10 flex w-full max-w-[1440px] flex-col gap-3 px-2 sm:px-4">
        {isLoading ? (
          ROWS.map((_, r) => (
            <div key={r} className="flex overflow-hidden py-2" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={cn("w-[240px] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white", CARD_SPACING)}>
                  <div className="aspect-[4/3] animate-pulse bg-[#f4f6fa]" />
                  <div className="space-y-2 p-4">
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-gray-100" />
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100" />
                    <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          rows.map((r, i) => <MarqueeRow key={i} items={r.items} direction={r.direction} pace={r.pace} actions={actions} />)
        )}
      </div>
    </section>
  )
}
