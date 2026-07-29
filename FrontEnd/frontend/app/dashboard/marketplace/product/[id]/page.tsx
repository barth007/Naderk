"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Heart, ShoppingBag, RefreshCw, Check, Minus, Plus,
  ShieldCheck, Truck, RotateCcw, PackageX,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import {
  useProduct, useAddToCart, useToggleWishlist, useWishlist,
} from '@/services/marketplace/marketplace.hooks';
import { ProductVariant } from '@/services/marketplace/marketplace.types';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: product, isLoading, isError } = useProduct(id);
  const { data: wishlist } = useWishlist();
  const addToCartMutation = useAddToCart();
  const toggleWishlistMutation = useToggleWishlist();

  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const inWishlist = wishlist?.items?.some(item => item.product === id) ?? false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff052f]" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fc] gap-3">
        <PackageX className="w-10 h-10 text-gray-300" />
        <p className="text-sm font-bold text-gray-600">Product not found</p>
        <Link href="/dashboard/marketplace" className="text-xs font-bold text-[#ff052f] hover:underline">
          ← Back to marketplace
        </Link>
      </div>
    );
  }

  const basePrice = parseFloat(product.price);
  const variantModifier = selectedVariant ? parseFloat(selectedVariant.price_modifier) : 0;
  const unitPrice = basePrice + variantModifier;
  const inStock = (selectedVariant ? selectedVariant.quantity_available : product.quantity_available) > 0;

  const handleAddToCart = (goToCart = false) => {
    if (product.variants.length > 0 && !selectedVariant) {
      toast.error('Please select a variant first.');
      return;
    }
    addToCartMutation.mutate({
      product_id: product.id,
      product_variant_id: selectedVariant?.id ?? product.variants?.[0]?.id ?? null,
      quantity,
    }, {
      onSuccess: () => {
        toast.success(`${product.name} added to cart!`);
        if (goToCart) router.push('/dashboard/cart');
      },
      onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Could not add item to cart.'),
    });
  };

  const handleToggleWishlist = () => {
    toggleWishlistMutation.mutate({ product_id: product.id }, {
      onSuccess: () => toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist'),
    });
  };

  const images = product.images?.length ? product.images : ['https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=600'];

  return (
    <div className="w-full bg-[#f8f9fc] min-h-screen text-[#1f2937] pb-16">
      {/* Breadcrumb */}
      <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6">
        <Breadcrumbs />
      </div>

      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#ff052f] transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Image gallery ── */}
        <div className="space-y-4">
          <div className="group aspect-square bg-white rounded-3xl border border-gray-100 overflow-hidden flex items-center justify-center cursor-zoom-in">
            <img
              src={images[activeImage]}
              alt={product.name}
              className="object-contain w-full h-full p-4 transition-transform duration-500 group-hover:scale-150"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 flex-wrap">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={cn(
                    "w-16 h-16 rounded-xl border-2 overflow-hidden bg-white transition",
                    activeImage === idx ? "border-[#ff052f]" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="object-contain w-full h-full p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Link
              href={`/dashboard/marketplace?category=${product.category_slug}`}
              className="text-[10px] font-extrabold text-[#ff052f] uppercase tracking-wider"
            >
              {product.category_name}
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#111827] leading-tight">{product.name}</h1>
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl font-black text-[#ff052f]">₦{unitPrice.toLocaleString()}</span>
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full",
                inStock ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500")}>
                {inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {product.description || 'No description provided for this product.'}
            </p>
          </div>

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Options</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const isSel = selectedVariant?.id === v.id;
                  const disabled = v.quantity_available <= 0;
                  return (
                    <button
                      key={v.id}
                      disabled={disabled}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5",
                        disabled ? "opacity-40 cursor-not-allowed border-gray-100 line-through"
                          : isSel ? "border-[#ff052f] bg-[#fff5f6] text-[#ff052f]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      {isSel && <Check className="w-3.5 h-3.5" />}
                      {v.variant_name}
                      {parseFloat(v.price_modifier) > 0 && (
                        <span className="text-[10px] text-gray-400">+₦{parseFloat(v.price_modifier).toLocaleString()}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Quantity</h3>
            <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2.5 hover:bg-gray-50 text-gray-500">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-5 text-sm font-bold text-gray-900">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="p-2.5 hover:bg-gray-50 text-gray-500">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => handleAddToCart(false)}
              disabled={addToCartMutation.isPending || !inStock}
              className="flex-1 bg-white border-2 border-[#ff052f] text-[#ff052f] hover:bg-[#fff5f6] disabled:opacity-50 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs"
            >
              {addToCartMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
              Add to Cart
            </button>
            <button
              onClick={() => handleAddToCart(true)}
              disabled={addToCartMutation.isPending || !inStock}
              className="flex-1 bg-[#ff052f] hover:bg-[#d90022] disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md shadow-red-100 transition flex items-center justify-center gap-2 text-xs"
            >
              Buy Now
            </button>
            <button
              onClick={handleToggleWishlist}
              className={cn("p-3 rounded-xl border transition shrink-0",
                inWishlist ? "bg-[#ff052f] text-white border-[#ff052f]" : "bg-white text-gray-400 border-gray-200 hover:text-[#ff052f]")}
            >
              <Heart className={cn("w-4 h-4", inWishlist && "fill-current")} />
            </button>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
            {[
              { icon: <ShieldCheck className="w-4 h-4" />, label: 'Authentic' },
              { icon: <Truck className="w-4 h-4" />, label: 'Fast Delivery' },
              { icon: <RotateCcw className="w-4 h-4" />, label: 'Easy Returns' },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-full bg-[#fff5f6] text-[#ff052f] flex items-center justify-center">{item.icon}</div>
                <span className="text-[10px] font-bold text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
