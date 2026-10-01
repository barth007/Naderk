"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useInView } from 'react-intersection-observer';
import {
  Search,
  ShoppingBag,
  Sparkles,
  ShoppingBagIcon,
  Package,
  RefreshCw,
  FlaskConical,
  HeartPulse,
  Glasses,
  SlidersHorizontal,
  ArrowRight,
  X,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import {
  useCategories,
  useAddToCart,
  useToggleWishlist,
  useWishlist,
  useCart,
  useFrames,
  useInfiniteProducts,
} from '@/services/marketplace/marketplace.hooks';
import { Product } from '@/services/marketplace/marketplace.types';
import ProductCard from '@/components/marketplace/ProductCard';
import FrameCard from '@/components/marketplace/FrameCard';
import CarouselRow from '@/components/marketplace/CarouselRow';
import { toast } from 'sonner';
import { useBrand } from '@/services/cms/admin-cms.hooks';
import { cn } from '@/lib/cn';

const FRAMES_TAB = '__frames__'; // sentinel slug for the eyewear-frames view

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  wellness: <HeartPulse className="w-4 h-4" />,
  frames: <Glasses className="w-4 h-4" />,
  'laboratory-equipment': <FlaskConical className="w-4 h-4" />,
};

const PRICE_CEILING = 2_500_000;

/** One horizontal shelf of products for a single category. */
function CategoryShelf({
  slug,
  name,
  description,
  sortBy,
  onSeeAll,
  cardProps,
  isInWishlist,
}: {
  slug: string;
  name: string;
  description?: string | null;
  sortBy: string;
  onSeeAll: () => void;
  cardProps: Omit<React.ComponentProps<typeof ProductCard>, 'product' | 'fixedWidth' | 'inWishlist'>;
  isInWishlist: (id: string) => boolean;
}) {
  // One page per shelf — the shelf is a teaser, "See all" opens the full grid.
  const { data, isLoading } = useInfiniteProducts({ category_slug: slug, sort_by: sortBy });
  const items = data?.pages.flatMap(p => p.results) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-[240px] h-[360px] shrink-0 bg-white border border-gray-100 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <CarouselRow
      title={name}
      subtitle={description || `${total} item${total === 1 ? '' : 's'}`}
      icon={<span className="text-[#ff052f]">{CATEGORY_ICONS[slug]}</span>}
      action={
        <button
          onClick={onSeeAll}
          className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff052f] transition-colors"
        >
          See all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      {items.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          fixedWidth
          {...cardProps}
          inWishlist={isInWishlist(product.id)}
        />
      ))}
    </CarouselRow>
  );
}

export default function MarketplacePage() {
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<number>(PRICE_CEILING);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const brand = useBrand();
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const { data: frames = [] } = useFrames(debouncedSearch || undefined);
  const { data: wishlist } = useWishlist();
  const { data: cart } = useCart();
  const toggleWishlistMutation = useToggleWishlist();
  const addToCartMutation = useAddToCart();

  const showingFrames = activeCategorySlug === FRAMES_TAB;
  // Browse mode = the shelves view. Any filter turns it into a flat grid, since
  // shelves-per-category stop making sense once you've narrowed to one.
  const isBrowsing = activeCategorySlug === null && !debouncedSearch;

  const {
    data: pagedProducts,
    isLoading: loadingProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts({
    category_slug: showingFrames ? undefined : activeCategorySlug ?? undefined,
    search: debouncedSearch || undefined,
    sort_by: sortBy,
  });

  const gridProducts = (pagedProducts?.pages.flatMap(p => p.results) ?? [])
    .filter(p => parseFloat(p.price) <= priceRange);
  const totalProducts = pagedProducts?.pages[0]?.total ?? 0;

  // Auto-load the next page when the sentinel scrolls into view.
  const { ref: sentinelRef, inView } = useInView({ rootMargin: '400px' });
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isBrowsing && !showingFrames) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, isBrowsing, showingFrames, fetchNextPage]);

  // There is also a StoreCategory called "Frames" holding Product rows that
  // duplicate the Frame catalogue. Rendering it would give two identically
  // labelled "Frames" tabs backed by different models. Eyewear is sold through
  // the Frame model (variants, lens builder, prescriptions), so that tab wins.
  const categoryTabs = categories.filter(cat => cat.slug !== 'frames');
  const visibleFrames = frames.filter(f => f.is_active && parseFloat(f.base_price) <= priceRange);

  const isInWishlist = (id: string) =>
    wishlist?.items?.some(item => item.product === id) ?? false;

  const handleToggleWishlist = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wasSaved = isInWishlist(productId);
    toggleWishlistMutation.mutate({ product_id: productId }, {
      onSuccess: () => toast.success(wasSaved ? 'Removed from wishlist' : 'Added to wishlist'),
      onError: () => toast.error('Could not update your wishlist.'),
    });
  };

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCartMutation.mutate({
      product_id: product.id,
      product_variant_id: product.variants?.[0]?.id ?? null,
      quantity: 1,
    }, {
      onSuccess: () => toast.success(`${product.name} added to cart`),
      onError: (err: unknown) => {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(detail ?? 'Could not add item to cart.');
      },
    });
  };

  const cardProps = {
    onToggleWishlist: handleToggleWishlist,
    onAddToCart: handleAddToCart,
    isAddingToCart: addToCartMutation.isPending,
  };

  const activeFilterCount = (debouncedSearch ? 1 : 0) + (priceRange < PRICE_CEILING ? 1 : 0);

  const tabClass = (active: boolean) =>
    cn(
      'px-3.5 h-9 inline-flex items-center gap-1.5 rounded-md text-xs font-bold transition-colors border',
      active
        ? 'bg-[#fff5f6] text-[#ff052f] border-[#ffccd3]'
        : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300',
    );

  const filterPanel = (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-700">Search</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-8 h-10 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff052f]/20 focus:border-[#ff052f] rounded-md text-sm bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-700">Category</label>
        {loadingCats ? (
          <RefreshCw className="w-4 h-4 animate-spin text-gray-300 my-2" />
        ) : (
          <div className="space-y-1">
            {[{ id: 'all', slug: null as string | null, name: 'All categories' },
              ...categoryTabs.map(c => ({ id: c.id, slug: c.slug as string | null, name: c.name })),
              { id: 'frames', slug: FRAMES_TAB as string | null, name: 'Eyewear frames' }].map(cat => {
              const active = activeCategorySlug === cat.slug;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategorySlug(cat.slug)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-semibold transition-colors text-left border',
                    active
                      ? 'bg-[#fff5f6] text-[#ff052f] border-[#ffccd3]'
                      : 'text-gray-600 border-transparent hover:bg-gray-50',
                  )}
                >
                  <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    active ? 'border-[#ff052f]' : 'border-gray-300')}>
                    {active && <span className="w-2 h-2 rounded-full bg-[#ff052f]" />}
                  </span>
                  <span className="truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <label className="text-xs font-bold text-gray-700">Max price</label>
          <span className="text-xs font-bold text-[#ff052f]">₦{priceRange.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={1000}
          max={PRICE_CEILING}
          step={5000}
          value={priceRange}
          onChange={e => setPriceRange(Number(e.target.value))}
          className="w-full accent-[#ff052f]"
        />
        <div className="flex justify-between text-[11px] text-gray-400 font-semibold">
          <span>₦1,000</span>
          <span>₦{PRICE_CEILING.toLocaleString()}</span>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <button
          onClick={() => { setSearch(''); setPriceRange(PRICE_CEILING); }}
          className="w-full h-10 rounded-md border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full bg-[#f8f9fc] min-h-screen text-[#1f2937]">
      <div className="bg-white px-6 rounded-md border border-gray-200 mb-6">
        <Breadcrumbs />
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">{brand.name} Marketplace</h1>
          <p className="text-gray-500 text-sm mt-1">
            Wellness products, designer frames, and professional laboratory equipment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/marketplace/optical-builder"
            className="inline-flex items-center gap-2 bg-[#ff052f] hover:bg-[#d90022] text-white font-bold px-4 h-10 rounded-md transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Glasses Builder
          </Link>
          <Link
            href="/dashboard/orders"
            aria-label="My Orders"
            title="My Orders"
            className="inline-flex items-center justify-center w-10 h-10 bg-white text-gray-600 hover:text-[#ff052f] transition-colors border border-gray-200 rounded-md hover:border-[#ffccd3]"
          >
            <Package className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard/cart"
            aria-label="Cart"
            className="relative inline-flex items-center justify-center w-10 h-10 bg-white text-gray-600 hover:text-[#ff052f] transition-colors border border-gray-200 rounded-md hover:border-[#ffccd3]"
          >
            <ShoppingBag className="w-4 h-4" />
            {cart?.items && cart.items.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#ff052f] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-white">
                {cart.items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
        {/* Filters — inline on desktop, collapsible on mobile */}
        <aside className="hidden lg:block bg-white p-5 rounded-md border border-gray-200 lg:sticky lg:top-6">
          <h2 className="text-sm font-extrabold text-gray-900 mb-4 pb-3 border-b border-gray-100">Filters</h2>
          {filterPanel}
        </aside>

        <div className="lg:hidden">
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-md px-4 h-11 text-sm font-bold text-gray-700"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="bg-[#ff052f] text-white text-[10px] rounded-full px-1.5 py-0.5">{activeFilterCount}</span>
              )}
            </span>
            <span className="text-gray-400">{filtersOpen ? '−' : '+'}</span>
          </button>
          {filtersOpen && (
            <div className="mt-3 bg-white p-5 rounded-md border border-gray-200">{filterPanel}</div>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          {/* Hero — promotes a real feature rather than a fabricated countdown */}
          <div
            className="relative bg-cover bg-center rounded-md p-6 md:p-8 text-white overflow-hidden min-h-[170px] flex flex-col justify-center"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(17,24,39,0.88), rgba(17,24,39,0.35)), url('https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=1200')`,
            }}
          >
            <div className="relative z-10 max-w-lg space-y-2.5">
              <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-white text-[#ff052f] uppercase tracking-wider">
                Prescription eyewear
              </span>
              <h2 className="text-xl md:text-2xl font-extrabold leading-tight">
                Build your glasses, frame to lens
              </h2>
              <p className="text-sm text-gray-200">
                Pick a frame, add your prescription, and choose the lens that fits how you see.
              </p>
              <Link
                href="/dashboard/marketplace/optical-builder"
                className="inline-flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 font-bold px-4 h-10 rounded-md text-sm transition-colors"
              >
                Start building <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Tabs + sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-2 flex-wrap min-w-0">
              <button onClick={() => setActiveCategorySlug(null)} className={tabClass(activeCategorySlug === null)}>
                All items
              </button>
              {categoryTabs.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategorySlug(cat.slug)}
                  className={tabClass(activeCategorySlug === cat.slug)}
                >
                  {CATEGORY_ICONS[cat.slug]}
                  {cat.name}
                </button>
              ))}
              <button onClick={() => setActiveCategorySlug(FRAMES_TAB)} className={tabClass(showingFrames)}>
                <Glasses className="w-4 h-4" /> Frames
              </button>
            </div>

            {!isBrowsing && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-400">Sort</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-white text-xs font-bold text-gray-700 border border-gray-200 rounded-md px-2.5 h-9 focus:outline-none focus:border-[#ff052f]"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="name_asc">Name A–Z</option>
                </select>
              </div>
            )}
          </div>

          {/* ── Browse: one horizontal shelf per category ── */}
          {isBrowsing ? (
            <div className="space-y-8">
              {categoryTabs.map(cat => (
                <CategoryShelf
                  key={cat.id}
                  slug={cat.slug}
                  name={cat.name}
                  description={cat.description}
                  sortBy={sortBy}
                  onSeeAll={() => setActiveCategorySlug(cat.slug)}
                  cardProps={cardProps}
                  isInWishlist={isInWishlist}
                />
              ))}

              {visibleFrames.length > 0 && (
                <CarouselRow
                  title="Eyewear Frames"
                  subtitle={`${visibleFrames.length} frame${visibleFrames.length === 1 ? '' : 's'}`}
                  icon={<Glasses className="w-4 h-4 text-[#ff052f]" />}
                  action={
                    <button
                      onClick={() => setActiveCategorySlug(FRAMES_TAB)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff052f] transition-colors"
                    >
                      See all <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  }
                >
                  {visibleFrames.map(frame => (
                    <FrameCard key={frame.id} frame={frame} fixedWidth />
                  ))}
                </CarouselRow>
              )}
            </div>
          ) : showingFrames ? (
            /* ── Frames grid ── */
            visibleFrames.length === 0 ? (
              <EmptyState
                icon={<Glasses className="w-9 h-9" />}
                title="No frames found"
                hint="Try a different search or raise the max price."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {visibleFrames.map(frame => <FrameCard key={frame.id} frame={frame} />)}
              </div>
            )
          ) : loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[360px] bg-white border border-gray-100 rounded-md animate-pulse" />
              ))}
            </div>
          ) : gridProducts.length === 0 ? (
            <EmptyState
              icon={<ShoppingBagIcon className="w-9 h-9" />}
              title="No products found"
              hint="Try a different category, or adjust your search and price range."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {gridProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    {...cardProps}
                    inWishlist={isInWishlist(product.id)}
                  />
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="pt-6 text-center">
                {isFetchingNextPage ? (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading more…
                  </span>
                ) : hasNextPage ? (
                  <button
                    onClick={() => fetchNextPage()}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-6 h-10 rounded-md transition-colors"
                  >
                    Load more
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 font-semibold">
                    Showing all {gridProducts.length} of {totalProducts} products
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="mt-16 border-t border-gray-200 py-8 text-center space-y-3">
        <p className="text-xs text-gray-400 font-semibold">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
        <div className="flex justify-center gap-6 text-xs text-gray-400 font-bold">
          <Link href="/privacy" className="hover:text-[#ff052f] transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#ff052f] transition-colors">Terms of Service</Link>
          <Link href="/rights" className="hover:text-[#ff052f] transition-colors">Patient&apos;s Rights</Link>
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="text-center py-20 bg-white rounded-md border border-dashed border-gray-200">
      <div className="mx-auto text-gray-300 mb-3 flex justify-center">{icon}</div>
      <h3 className="font-bold text-gray-700 text-sm">{title}</h3>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
