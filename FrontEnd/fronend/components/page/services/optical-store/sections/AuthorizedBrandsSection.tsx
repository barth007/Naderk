"use client"

import { motion } from "framer-motion"
import { OPTICAL_STORE_CONTENT } from "./optical-store.constants"

export function AuthorizedBrandsSection() {
  const { brands } = OPTICAL_STORE_CONTENT

  return (
    <section className="border-t border-border bg-background py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          AUTHORIZED DEALER FOR
        </h2>
        
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-12 gap-y-8 grayscale transition-all duration-500 hover:grayscale-0">
          {brands.map((brand, index) => (
            <motion.div
              key={brand}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.5 }}
              whileHover={{ opacity: 1, scale: 1.05 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="text-2xl font-black italic tracking-tighter text-foreground sm:text-3xl lg:text-4xl"
            >
              {brand.toUpperCase()}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
