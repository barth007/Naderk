"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, Check, Sparkles, Glasses, ShieldCheck, Ruler, Palette, PackageX, ShoppingBag,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { useFrame, useAddToCart } from '@/services/marketplace/marketplace.hooks';
import { FrameVariant } from '@/services/marketplace/marketplace.types';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

export default function FrameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: frame, isLoading, isError } = useFrame(id);
  const addToCart = useAddToCart();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff052f]" />
      </div>
    );
  }

  if (isError || !frame) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fc] gap-3">
        <PackageX className="w-10 h-10 text-gray-300" />
        <p className="text-sm font-bold text-gray-600">Frame not found</p>
        <Link href="/dashboard/marketplace/optical-builder" className="text-xs font-bold text-[#ff052f] hover:underline">
          ← Back to Glasses Builder
        </Link>
      </div>
    );
  }

  const gallery = (frame.images && frame.images.length ? frame.images : (frame.front_image ? [frame.front_image] : []));
  const images = gallery.length ? gallery : ['https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=600'];
  const image = images[Math.min(activeImage, images.length - 1)];
  const inStock = frame.variants.some(v => v.quantity_available > 0);

  // Independent color / size selection resolved to a concrete variant
  const uniqueColors = [...new Set(frame.variants.map(v => v.color))];
  const uniqueSizes = [...new Set(frame.variants.map(v => v.size))];

  // A color/size is offered if at least one in-stock variant has it (respecting the other selection)
  const colorAvailable = (color: string) =>
    frame.variants.some(v => v.color === color && v.quantity_available > 0 && (!selectedSize || v.size === selectedSize));
  const sizeAvailable = (size: string) =>
    frame.variants.some(v => v.size === size && v.quantity_available > 0 && (!selectedColor || v.color === selectedColor));

  const resolvedVariant: FrameVariant | null =
    selectedColor && selectedSize
      ? frame.variants.find(v => v.color === selectedColor && v.size === selectedSize) ?? null
      : null;

  const selectionComplete = !!resolvedVariant && resolvedVariant.quantity_available > 0;

  const handleCustomize = () => {
    if (uniqueColors.length > 0 && !selectedColor) { return; }
    if (uniqueSizes.length > 0 && !selectedSize) { return; }
    // Carry the chosen frame + variant into the builder so it's pre-selected
    sessionStorage.setItem('builderPreselectFrameId', frame.id);
    if (resolvedVariant) sessionStorage.setItem('builderPreselectVariantId', resolvedVariant.id);
    router.push('/dashboard/marketplace/optical-builder');
  };

  const handleBuyFrameOnly = () => {
    if (!resolvedVariant) { toast.error('Please select a color and size first.'); return; }
    // Frame-only purchase — no lens, no prescription
    addToCart.mutate({ frame_variant_id: resolvedVariant.id, quantity: 1 }, {
      onSuccess: () => toast.success('Frame added to cart.'),
      onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Could not add frame to cart.'),
    });
  };

  const specs = [
    { icon: <Sparkles className="w-4 h-4" />, label: 'Brand', value: frame.brand },
    { icon: <Glasses className="w-4 h-4" />, label: 'Style', value: frame.style },
    { icon: <ShieldCheck className="w-4 h-4" />, label: 'Material', value: frame.material },
  ];

  return (
    <div className="w-full bg-[#f8f9fc] min-h-screen text-[#1f2937] pb-16">
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

        {/* Image gallery */}
        <div className="space-y-4">
          <div className="group aspect-square bg-white rounded-3xl border border-gray-100 overflow-hidden flex items-center justify-center cursor-zoom-in">
            <img
              src={image}
              alt={frame.name}
              className="object-contain w-full h-full p-6 transition-transform duration-500 group-hover:scale-150"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 flex-wrap">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-white transition ${activeImage === idx ? 'border-[#ff052f]' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <img src={img} alt={`${frame.name} view ${idx + 1}`} className="object-contain w-full h-full p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-[#ff052f] uppercase tracking-wider">{frame.brand}</span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#111827] leading-tight">{frame.name}</h1>
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl font-black text-[#ff052f]">₦{parseFloat(frame.base_price).toLocaleString()}</span>
              <span className="text-[10px] text-gray-400 font-bold">frame only — lenses added in builder</span>
            </div>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-3 gap-3">
            {specs.map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-[#fff5f6] text-[#ff052f] flex items-center justify-center">{s.icon}</div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
                <span className="text-[11px] font-bold text-gray-800">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">About this frame</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              The {frame.name} is a {frame.style.toLowerCase()} style frame crafted from {frame.material.toLowerCase()},
              part of the {frame.brand} collection. Pair it with your preferred vision lenses and coatings in the
              Glasses Builder to create a complete, prescription-ready pair.
            </p>
          </div>

          {/* Color selector */}
          {uniqueColors.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Color
                {selectedColor && <span className="text-gray-800 normal-case tracking-normal">— {selectedColor}</span>}
              </h3>
              <div className="flex flex-wrap gap-2">
                {uniqueColors.map(color => {
                  const isSel = selectedColor === color;
                  const avail = colorAvailable(color);
                  return (
                    <button
                      key={color}
                      disabled={!avail}
                      onClick={() => setSelectedColor(isSel ? null : color)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5",
                        !avail ? "opacity-40 cursor-not-allowed border-gray-100 line-through"
                          : isSel ? "border-[#ff052f] bg-[#fff5f6] text-[#ff052f]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      {isSel && <Check className="w-3.5 h-3.5" />}
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size selector */}
          {uniqueSizes.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5" /> Size
                {selectedSize && <span className="text-gray-800 normal-case tracking-normal">— {selectedSize}</span>}
              </h3>
              <div className="flex flex-wrap gap-2">
                {uniqueSizes.map(size => {
                  const isSel = selectedSize === size;
                  const avail = sizeAvailable(size);
                  return (
                    <button
                      key={size}
                      disabled={!avail}
                      onClick={() => setSelectedSize(isSel ? null : size)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5",
                        !avail ? "opacity-40 cursor-not-allowed border-gray-100 line-through"
                          : isSel ? "border-[#ff052f] bg-[#fff5f6] text-[#ff052f]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      {isSel && <Check className="w-3.5 h-3.5" />}
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selection status */}
          {selectedColor && selectedSize && !selectionComplete && (
            <p className="text-[11px] font-bold text-red-500">
              This color/size combination is out of stock. Try another.
            </p>
          )}

          {/* CTA */}
          <div className="pt-2">
            <button
              onClick={handleCustomize}
              disabled={!inStock || (uniqueColors.length > 0 && !selectedColor) || (uniqueSizes.length > 0 && !selectedSize) || (!!selectedColor && !!selectedSize && !selectionComplete)}
              className="w-full bg-[#ff052f] hover:bg-[#d90022] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-md shadow-red-100 transition flex items-center justify-center gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              {!inStock ? 'Currently Unavailable'
                : (uniqueColors.length > 0 && !selectedColor) ? 'Select a color'
                : (uniqueSizes.length > 0 && !selectedSize) ? 'Select a size'
                : 'Customize in Glasses Builder'}
            </button>

            {/* Buy frame only */}
            <button
              onClick={handleBuyFrameOnly}
              disabled={!inStock || !selectionComplete || addToCart.isPending}
              className="w-full mt-2 bg-white border-2 border-[#ff052f] text-[#ff052f] hover:bg-[#fff5f6] disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs"
            >
              {addToCart.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
              Buy Frame Only — ₦{parseFloat(frame.base_price).toLocaleString()}
            </button>

            <p className="text-[10px] text-gray-400 font-semibold text-center mt-2">
              Add lenses in the builder, or buy just the frame.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
