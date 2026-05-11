import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { TELEHEALTH_CONTENT } from "./telehealth.constants"

export function TelehealthTestimonialSection() {
  const { testimonial } = TELEHEALTH_CONTENT

  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24 border-t border-border">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--destructive)]/5 text-[var(--destructive)]">
            <AnimatedIcon name="quote" size={24} />
          </div>
        </div>

        <blockquote className="text-xl font-bold leading-relaxed text-foreground sm:text-2xl lg:text-3xl lg:leading-tight">
          “{testimonial.quote}”
        </blockquote>

        <div className="mt-10">
          <p className="text-sm font-bold text-foreground">
            {testimonial.author}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {testimonial.role}
          </p>
        </div>
      </div>
    </section>
  )
}
