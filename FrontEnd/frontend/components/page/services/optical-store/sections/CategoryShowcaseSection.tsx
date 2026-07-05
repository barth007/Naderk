"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { OPTICAL_STORE_CONTENT } from "./optical-store.constants"

export function CategoryShowcaseSection() {
  const { categories } = OPTICAL_STORE_CONTENT

  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-foreground">Shop by category</h2>
          <p className="mt-2 text-muted-foreground">Tailored styles for everyone</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                href={category.href}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[2rem] bg-muted"
              >
                <Image
                  src={category.image}
                  alt={category.title}
                  fill
                  className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-75"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
                
                <div className="absolute bottom-8 left-8">
                  <h3 className="text-2xl font-bold text-white transition-transform duration-300 group-hover:-translate-y-1">
                    {category.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-white/80 transition-transform duration-300 group-hover:-translate-y-1">
                    Shop Now →
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
