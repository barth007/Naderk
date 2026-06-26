"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search,
  Heart,
  ShoppingBag,
  Sparkles,
  Check,
  ShoppingBagIcon,
  RefreshCw,
  FlaskConical,
  HeartPulse,
  Glasses,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import {
  useProducts,
  useCategories,
  useAddToCart,
  useToggleWishlist,
  useWishlist,
  useCart,
} from '@/services/marketplace/marketplace.hooks';
import { Product } from '@/services/marketplace/marketplace.types';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

// Icon map for the 3 categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  wellness: <HeartPulse className="w-4 h-4" />,
  frames: <Glasses className="w-4 h-4" />,
  'laboratory-equipment': <FlaskConical className="w-4 h-4" />,
};

// Badge helper — rotate through styles based on product index
const BADGE_STYLES = [
  { text: '50% OFF',     cls: 'bg-white text-[#ff052f] border border-[#ff052f]' },
  { text: 'BEST SELLER', cls: 'bg-[#ff052f] text-white' },
  { text: 'NEW ARRIVAL', cls: 'bg-[#e0f2fe] text-[#0369a1]' },
  { text: 'FLASH SALE',  cls: 'bg-[#ff052f] text-white' },
];

export default function MarketplacePage() {
  // Active category slug (null = All)
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);

  // Additional filters
  const [priceRange, setPriceRange] = useState<number>(2500000);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Countdown timer for the promo banner
  const [countdown, setCountdown] = useState({ hours: 2, minutes: 25, seconds: 12 });
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        clearInterval(timer);
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Data hooks
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const { data: products = [], isLoading: loadingProducts } = useProducts({
    category_slug: activeCategorySlug ?? undefined,
    search: search || undefined,
    sort_by: sortBy,
  });
  const { data: wishlist } = useWishlist();
  const { data: cart } = useCart();
  const toggleWishlistMutation = useToggleWishlist();
  const addToCartMutation = useAddToCart();

  // Client-side price filter on top of server results
  const filteredProducts = products.filter(prod => parseFloat(prod.price) <= priceRange);

  const isInWishlist = (id: string) =>
    wishlist?.items?.some(item => item.product === id) ?? false;

  const handleToggleWishlist = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlistMutation.mutate({ product_id: productId }, {
      onSuccess: () => {
        toast.success(isInWishlist(productId) ? 'Removed from wishlist' : 'Added to wishlist');
      },
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
      onSuccess: () => toast.success(`${product.name} added to cart!`),
      onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Could not add item to cart.'),
    });
  };

  return (
    <div className="w-full bg-[#f8f9fc] min-h-screen text-[#1f2937]">

      {/* Breadcrumb */}
      <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6">
        <Breadcrumbs />
      </div>

      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Naderk Marketplace</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Explore wellness products, designer frames, and professional laboratory equipment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/marketplace/optical-builder"
            className="inline-flex items-center gap-2 bg-[#ff052f] hover:bg-[#d90022] text-white font-bold px-4 py-2 rounded-full shadow-md shadow-red-100 transition text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch Glasses Builder
          </Link>
          <Link
            href="/dashboard/cart"
            className="relative p-2 bg-white text-[#374151] hover:text-[#ff052f] transition border border-gray-200 rounded-full hover:border-[#ffe4e6]"
          >
            <ShoppingBag className="w-4 h-4" />
            {cart?.items && cart.items.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#ff052f] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white">
                {cart.items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* ── Left Filters ── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-6 lg:sticky lg:top-6">
          <div>
            <h3 className="font-extrabold text-sm text-[#111827] uppercase tracking-wider mb-4">Filters</h3>
            <div className="h-px bg-gray-100 w-full" />
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Search</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-xl text-xs bg-[#f8f9fc]"
              />
            </div>
          </div>

          {/* Category — API-driven */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Category</span>

            {loadingCats ? (
              <RefreshCw className="w-4 h-4 animate-spin text-gray-300 mx-auto my-2" />
            ) : (
              <div className="space-y-1">
                {/* All option */}
                <button
                  onClick={() => setActiveCategorySlug(null)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left",
                    activeCategorySlug === null
                      ? "bg-[#fff5f6] text-[#ff052f] border border-[#ffccd3]"
                      : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                    activeCategorySlug === null ? "border-[#ff052f]" : "border-gray-300"
                  )}>
                    {activeCategorySlug === null && <div className="w-1.5 h-1.5 rounded-full bg-[#ff052f]" />}
                  </div>
                  All Categories
                </button>

                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategorySlug(cat.slug)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left",
                      activeCategorySlug === cat.slug
                        ? "bg-[#fff5f6] text-[#ff052f] border border-[#ffccd3]"
                        : "text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                      activeCategorySlug === cat.slug ? "border-[#ff052f]" : "border-gray-300"
                    )}>
                      {activeCategorySlug === cat.slug && <div className="w-1.5 h-1.5 rounded-full bg-[#ff052f]" />}
                    </div>
                    <span className="text-gray-400">
                      {CATEGORY_ICONS[cat.slug] ?? null}
                    </span>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price Range */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Max Price</span>
            <input
              type="range"
              min="1000"
              max="2500000"
              step="5000"
              value={priceRange}
              onChange={e => setPriceRange(Number(e.target.value))}
              className="w-full accent-[#ff052f]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-bold">
              <span>₦1,000</span>
              <span>₦{priceRange.toLocaleString()}</span>
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Colors</span>
            <div className="flex gap-2 flex-wrap">
              {[
                { name: 'Red',       hex: '#ff052f' },
                { name: 'Blue',      hex: '#60a5fa' },
                { name: 'Purple',    hex: '#6366f1' },
                { name: 'Dark Grey', hex: '#1f2937' },
              ].map(color => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(selectedColor === color.name ? '' : color.name)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition relative flex items-center justify-center",
                    selectedColor === color.name ? "border-gray-400 scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {selectedColor === color.name && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Product Grid ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Promo Banner */}
          <div
            className="relative bg-cover bg-center rounded-3xl p-6 md:p-8 text-white overflow-hidden min-h-[160px] flex flex-col justify-center"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.72), rgba(0,0,0,0.2)), url('https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=1200')`,
            }}
          >
            <div className="relative z-10 max-w-md space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-[9px] font-extrabold bg-white text-[#ff052f] uppercase tracking-wider">
                Limited Time Offer
              </span>
              <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight">
                Flash Deals — Up to 60% Off
              </h2>
              <p className="text-[11px] text-gray-200">
                Next drop in: {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
              </p>
            </div>
          </div>

          {/* Category Tab Pills + Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-100">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategorySlug(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition",
                  activeCategorySlug === null
                    ? "bg-[#fff5f6] text-[#ff052f] border border-[#ffccd3]"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                All Items
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategorySlug(cat.slug)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5",
                    activeCategorySlug === cat.slug
                      ? "bg-[#fff5f6] text-[#ff052f] border border-[#ffccd3]"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {CATEGORY_ICONS[cat.slug]}
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-gray-400">Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="name_asc">Name A–Z</option>
              </select>
            </div>
          </div>

          {/* Category description strip */}
          {activeCategorySlug && (
            <div className="bg-white border border-gray-100 rounded-xl px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#fff5f6] text-[#ff052f] flex items-center justify-center shrink-0">
                {CATEGORY_ICONS[activeCategorySlug] ?? <ShoppingBagIcon className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-extrabold text-gray-900">
                  {categories.find(c => c.slug === activeCategorySlug)?.name}
                </p>
                <p className="text-[10px] text-gray-400 font-semibold">
                  {categories.find(c => c.slug === activeCategorySlug)?.description}
                </p>
              </div>
            </div>
          )}

          {/* Product Grid */}
          {loadingProducts ? (
            <div className="py-20 flex justify-center">
              <RefreshCw className="animate-spin text-[#ff052f] w-8 h-8" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <ShoppingBagIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <h3 className="font-semibold text-gray-600 text-sm">No products found</h3>
              <p className="text-xs text-gray-400 mt-1">Try a different category or adjust the price range.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product, idx) => {
                const badge = BADGE_STYLES[idx % BADGE_STYLES.length];
                const inWishlist = isInWishlist(product.id);
                return (
                  <motion.div
                    layout
                    key={product.id}
                    className="group bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-gray-200/80 transition duration-300 flex flex-col"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-[#f8f9fc] overflow-hidden">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="object-cover w-full h-full group-hover:scale-105 transition duration-500"
                      />
                      <span className={cn("absolute top-2.5 left-2.5 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full", badge.cls)}>
                        {badge.text}
                      </span>
                      <button
                        onClick={e => handleToggleWishlist(product.id, e)}
                        className={cn(
                          "absolute top-2.5 right-2.5 p-1.5 rounded-full transition",
                          inWishlist ? "bg-[#ff052f] text-white" : "bg-white text-gray-300 hover:text-[#ff052f]"
                        )}
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {product.category_name}
                        </span>
                        <h4 className="font-bold text-gray-900 text-xs leading-snug line-clamp-2">{product.name}</h4>
                        <p className="text-[10px] text-gray-400 font-semibold line-clamp-1">{product.description}</p>
                      </div>

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="font-black text-[#ff052f] text-sm">
                          ₦{parseFloat(product.price).toLocaleString()}
                        </span>
                      </div>

                      <button
                        onClick={e => handleAddToCart(product, e)}
                        disabled={addToCartMutation.isPending}
                        className="w-full bg-[#ff052f] hover:bg-[#d90022] disabled:opacity-50 text-white text-[11px] font-bold py-2 rounded-xl transition shadow-xs"
                      >
                        Buy Now
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {!loadingProducts && filteredProducts.length > 0 && (
            <div className="pt-8 text-center space-y-3">
              <button className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-xs">
                Load More Products
              </button>
              <p className="text-[10px] text-gray-400 font-bold">
                Showing {filteredProducts.length} products
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-100 py-10 text-center space-y-4">
        <p className="text-[10px] text-gray-400 font-semibold">© 2026 NaderkEye Care. All rights reserved.</p>
        <div className="flex justify-center gap-6 text-[10px] text-gray-400 font-bold">
          <Link href="/privacy" className="hover:text-[#ff052f] transition">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#ff052f] transition">Terms of Service</Link>
          <Link href="/rights" className="hover:text-[#ff052f] transition">Patient's Rights</Link>
        </div>
      </footer>
    </div>
  );
}
