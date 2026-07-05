import Image from "next/image";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { cn } from "@/lib/cn";
import type { TestimonialType } from "./testimonials-wall.types";

interface TestimonialCardProps {
  testimonial: TestimonialType;
  className?: string;
}

export function TestimonialCard({ testimonial, className }: TestimonialCardProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-5 rounded-md bg-card p-6 shadow-sm border border-border transition-all hover:bg-muted/50",
        className
      )}
    >
      <div className="flex items-center gap-4">
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
          {(testimonial.role || testimonial.location) && (
            <span className="text-xs text-muted-foreground">
              {testimonial.role} {testimonial.role && testimonial.location ? "•" : ""} {testimonial.location}
            </span>
          )}
        </div>
      </div>
      
      <p className="text-sm leading-relaxed text-foreground">
        "{testimonial.quote}"
      </p>

      {testimonial.rating && (
        <div className="mt-auto flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <AnimatedIcon
              key={i}
              name="star"
              size={14}
              className={cn(
                i >= testimonial.rating! && "opacity-30 grayscale"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
