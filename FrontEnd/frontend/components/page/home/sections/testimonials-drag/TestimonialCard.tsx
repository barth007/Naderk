import Image from "next/image";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { cn } from "@/lib/cn";
import type { TestimonialType } from "./testimonials.types";

interface TestimonialCardProps {
  testimonial: TestimonialType;
  className?: string;
}

export function TestimonialCard({ testimonial, className }: TestimonialCardProps) {
  return (
    <div
      className={cn(
        "flex w-[320px] md:w-[400px] h-full shrink-0 flex-col gap-6 rounded-3xl bg-card/60 p-8 shadow-sm backdrop-blur-md border border-white/20 transition-colors hover:bg-card/80",
        className
      )}
    >
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <AnimatedIcon
            key={i}
            name="star"
            size={16}
            className={cn(
              i >= testimonial.rating && "opacity-30 grayscale"
            )}
          />
        ))}
      </div>
      
      <p className="text-lg leading-relaxed text-foreground md:text-xl">
        "{testimonial.quote}"
      </p>

      <div className="mt-auto flex items-center gap-4 pt-4">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border">
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{testimonial.name}</span>
          <span className="text-sm text-muted-foreground">
            {testimonial.role}, {testimonial.company}
          </span>
        </div>
      </div>
    </div>
  );
}
