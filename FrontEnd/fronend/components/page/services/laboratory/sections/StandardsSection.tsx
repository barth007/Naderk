import Image from "next/image"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { LABORATORY_CONTENT } from "./laboratory.constants"
import type { LabStandardFeature } from "./laboratory.types"

function FeatureItem({ feature }: { feature: LabStandardFeature }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)]">
        <AnimatedIcon name={feature.icon} size={20} />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

export function StandardsSection() {
  const { standards } = LABORATORY_CONTENT

  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24" aria-labelledby="standards-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <div className="max-w-xl">
            <h2 id="standards-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {standards.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {standards.description}
            </p>

            <div className="mt-10 space-y-8">
              {standards.features.map((feature) => (
                <FeatureItem key={feature.title} feature={feature} />
              ))}
            </div>
          </div>

          {/* Right: Image composition */}
          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative h-[400px] w-full max-w-[500px] sm:h-[500px]">
              {/* Main Image */}
              <div className="absolute left-0 top-0 h-[80%] w-[70%] overflow-hidden rounded-2xl shadow-[var(--shadow-lg)]">
                <Image
                  src={standards.images[0].src}
                  alt={standards.images[0].alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 70vw, 400px"
                />
              </div>

              {/* Overlapping Image */}
              <div className="absolute bottom-0 right-0 h-[60%] w-[60%] overflow-hidden rounded-md shadow-[var(--shadow-xl)] border-8 border-background">
                <Image
                  src={standards.images[1].src}
                  alt={standards.images[1].alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 60vw, 300px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
