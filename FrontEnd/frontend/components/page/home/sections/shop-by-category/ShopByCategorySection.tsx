'use client'

import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { apiClient } from "@/lib/api"
import { cn } from "@/lib/cn"
import ProductCard from "@/components/marketplace/ProductCard"
import { useShopActions } from "@/components/shop/useShopActions"
import { useShopUi } from "@/store/useShopUi"
import { ProductCarousel } from "./ProductCarousel"
import type { Product, StoreCategory } from "@/services/marketplace/marketplace.types"

/**
 * "Shop by category" on the home page: a few categories picked at random, one
 * shown at a time behind tabs, each with a random handful of its products in a
 * full-width carousel.
 *
 * Everything here works signed out: a card opens the product's quick view, and
 * Add to cart fills the guest basket. The wishlist asks for a login.
 */

const TAB_COUNT = 4
/** Categories tried, so that empty ones can be skipped and still fill TAB_COUNT tabs. */
const CANDIDATES = 8
/** Products drawn per tab; the carousel repeats them if there are few. */
const PRODUCTS_PER_TAB = 16
const SHOP_HREF = "/dashboard/marketplace"

type Tab = { category: StoreCategory; products: Product[] }

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function useCategoryTabs() {
  return useQuery({
    queryKey: ["home-shop-by-category"],
    queryFn: async (): Promise<Tab[]> => {
      const all = ((await apiClient.get("/marketplace/categories/")).data.data ?? []) as StoreCategory[]
      // The "frames" product category duplicates the frame catalogue (see the
      // shop page), so it is left out. Top-level categories already include
      // their subcategories' products.
      const usable = all.filter((c) => c.slug !== "frames")
      const topLevel = usable.filter((c) => !c.parent)
      const candidates = shuffle(topLevel.length >= TAB_COUNT ? topLevel : usable).slice(0, CANDIDATES)

      const tabs = await Promise.all(candidates.map(async (category) => {
        try {
          const res = await apiClient.get("/marketplace/products/", {
            params: { category_slug: category.slug, sort_by: "random", limit: PRODUCTS_PER_TAB },
          })
          const products = ((res.data.data?.results ?? []) as Product[]).filter((p) => p.is_active)
          return { category, products }
        } catch {
          return { category, products: [] as Product[] }
        }
      }))
      return tabs.filter((t) => t.products.length > 0).slice(0, TAB_COUNT)
    },
    // A new draw on every visit to the page, but never mid-viewing.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function ShopByCategorySection() {
  const { data: tabs = [], isLoading } = useCategoryTabs()
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()
  const openQuickView = useShopUi((s) => s.openQuickView)
  const { add, wish, inWishlist, isAdding } = useShopActions()

  if (!isLoading && tabs.length === 0) return null

  const current = tabs[Math.min(active, Math.max(tabs.length - 1, 0))]

  // Arrow keys move between tabs, as screen-reader users expect of a tablist.
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.length - 1
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0 : e.key === "End" ? last : null
    if (next === null) return
    e.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  // The shop's cards link to the dashboard's product page; here any link on a
  // card opens the quick view instead, so no account is needed to look.
  const openFromCard = (e: MouseEvent, product: Product) => {
    if (!(e.target as HTMLElement).closest("a")) return
    e.preventDefault()
    e.stopPropagation()
    openQuickView(product)
  }

  const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
  const renderCard = (product: Product) => (
    <div className="grid w-full" onClickCapture={(e) => openFromCard(e, product)}>
      <ProductCard
        product={product}
        compact
        inWishlist={inWishlist(product.id)}
        isAddingToCart={isAdding}
        onToggleWishlist={(id, e) => { e.preventDefault(); e.stopPropagation(); wish(id) }}
        onAddToCart={(p, e) => { e.preventDefault(); e.stopPropagation(); add(p) }}
      />
    </div>
  )

  return (
    <section aria-labelledby="shop-by-category-title" className="overflow-hidden bg-background py-12 sm:py-20">
      <div className={container}>
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-2.5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--destructive)]">Shop</p>
          <h2 id="shop-by-category-title" className="text-2xl font-bold leading-tight text-foreground sm:text-4xl">
            Shop by category
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Pick a category to see what&rsquo;s in it. Open any product for its details, no account needed.
          </p>
        </header>
      </div>

      {isLoading ? (
        <div aria-hidden className="mt-8">
          <div className={container}>
            <div className="mx-auto flex max-w-xl justify-center gap-7 border-b border-gray-100 pb-3">
              {Array.from({ length: TAB_COUNT }).map((_, i) => <div key={i} className="h-4 w-24 animate-pulse rounded bg-gray-100" />)}
            </div>
          </div>
          <div className="mt-12 flex overflow-hidden py-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="mr-3 w-[168px] shrink-0 overflow-hidden rounded-md border border-gray-200 sm:mr-5 sm:w-[220px] lg:w-[240px]">
                <div className="aspect-[4/3] animate-pulse bg-[#f4f6fa]" />
                <div className="space-y-2 p-4">
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-gray-100" />
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={container}>
            <div
              role="tablist"
              aria-label="Product categories"
              className="no-scrollbar mt-6 flex gap-5 overflow-x-auto border-b border-gray-200 sm:mt-8 sm:justify-center sm:gap-8"
            >
              {tabs.map((t, i) => {
                const selected = t === current
                return (
                  <button
                    key={t.category.id}
                    ref={(el) => { tabRefs.current[i] = el }}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${i}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(i)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    className={cn(
                      "-mb-px min-h-11 shrink-0 border-b-[2.5px] px-1 text-sm transition-colors sm:min-h-12 sm:text-[15px]",
                      selected
                        ? "border-[var(--destructive)] font-bold text-foreground"
                        : "border-transparent font-medium text-gray-500 hover:text-foreground",
                    )}
                  >
                    {t.category.name}
                  </button>
                )
              })}
            </div>
          </div>

          {current && (
            <div
              role="tabpanel"
              id={`${baseId}-panel`}
              aria-labelledby={`${baseId}-tab-${tabs.indexOf(current)}`}
              className="mt-4 sm:mt-7"
            >
              <div className={cn(container, "mb-3 flex flex-wrap items-center justify-between gap-x-3 sm:mb-5")}>
                <p className="hidden text-sm text-muted-foreground sm:block">{current.category.description || "\u00a0"}</p>
                <Link
                  href={`${SHOP_HREF}?category=${encodeURIComponent(current.category.slug)}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#B42318] hover:text-[#7A1A10]"
                >
                  View all {current.category.name} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              {/* Full page width; a new carousel per tab so it starts from the beginning. */}
              <ProductCarousel
                key={current.category.id}
                label={`${current.category.name} products`}
                items={current.products}
                itemKey={(p) => p.id}
                renderItem={renderCard}
              />

              <div className={cn(container, "mt-6 flex justify-center sm:mt-8")}>
                <Link
                  href={SHOP_HREF}
                  className="inline-flex min-h-[46px] items-center gap-1.5 rounded-full border border-gray-200 px-5 text-sm font-semibold text-foreground hover:border-[#F5C9C9] hover:text-[#B42318]"
                >
                  Browse the whole shop <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
