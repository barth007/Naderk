"use client"

import { motion } from "framer-motion"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { Button, Card } from "@/components/ui"
import { OPTICAL_STORE_CONTENT } from "./optical-store.constants"

export function PrescriptionUploadSection() {
  const { prescription } = OPTICAL_STORE_CONTENT

  return (
    <section id="upload" className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {prescription.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {prescription.description}
            </p>

            <ul className="mt-10 space-y-4">
              {prescription.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <AnimatedIcon name="check" size={20} className="text-[var(--destructive)]" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: Upload Area */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="relative overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/5 p-8 text-center transition-all hover:border-[var(--destructive)]/30 hover:bg-muted/10">
              <div className="flex flex-col items-center justify-center py-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)]">
                  <AnimatedIcon name="upload" size={32} />
                </div>
                <h3 className="text-xl font-bold text-foreground">Upload your RX</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Supporting formats: PDF, JPEG, PNG (Max 5MB)
                </p>
                <div className="mt-8">
                  <Button
                    variant="ghost"
                    className="rounded-xl bg-[var(--destructive)]/10 px-8 font-bold text-[var(--destructive)] hover:bg-[var(--destructive)]/20 hover:opacity-100"
                  >
                    Choose File
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
