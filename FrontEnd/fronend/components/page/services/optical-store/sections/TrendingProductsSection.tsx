"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { Badge, Button } from "@/components/ui"
import { cn } from "@/lib/cn"
import { OPTICAL_STORE_CONTENT } from "./optical-store.constants"
import type { Product } from "./optical-store.types"

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden rounded-md bg-[#F5F5F7] transition-all duration-500 group-hover:shadow-[var(--shadow-xl)] group-hover:-translate-y-1">
        <Image
          src={product.image}
          alt={product.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes="(max-width: 768px) 50vw, 300px"
        />

        {/* Badge */}
        {product.badge && (
          <Badge
            className={cn(
              "absolute left-5 top-5 rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest border-none",
              product.badge === "BESTSELLER" ? "bg-[#FFF1F1] text-[var(--destructive)]" : "bg-black text-white"
            )}
          >
            {product.badge}
          </Badge>
        )}

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            setIsWishlisted(!isWishlisted)
          }}
          className={cn(
            "absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-md bg-white/80 backdrop-blur-md transition-all duration-300",
            "hover:scale-110 active:scale-95",
            isWishlisted ? "text-[var(--destructive)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <AnimatedIcon name="like" size={20} className={cn(isWishlisted && "fill-current")} />
        </button>

        {/* Quick Actions Overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-4 bottom-6 z-10 flex gap-2"
            >
              <Button
                variant="destructive"
                className="flex-1 rounded-md h-12 gap-2 text-xs font-bold uppercase shadow-lg shadow-[var(--destructive)]/20"
              >
                <AnimatedIcon name="cart" size={16} />
                Add to Cart
              </Button>
              <Button
                variant="ghost"
                className="w-12 h-12 rounded-md bg-white/90 backdrop-blur-md p-0 hover:bg-white transition-colors shadow-lg"
                title="Quick View"
              >
                <AnimatedIcon name="zoom" size={16} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product Details */}
      <div className="mt-6 px-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {product.brand}
          </p>
          <p className="text-sm font-bold text-[var(--destructive)]">
            ₦{product.price.toLocaleString()}
          </p>
        </div>
        <h3 className="mt-1 text-base font-bold text-foreground">
          {product.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {product.colors} Colors Available
        </p>
      </div>
    </motion.div>
  )
}

export function TrendingProductsSection() {
  const { products } = OPTICAL_STORE_CONTENT

  return (
    <section id="trending" className="bg-[#F9FAFB] py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Trending Now</h2>
            <p className="mt-2 text-muted-foreground">Our most popular frames this week</p>
          </div>
          <Link href="/coming-soon" className="text-sm font-bold text-[var(--destructive)] hover:underline">
            View All Collection
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

