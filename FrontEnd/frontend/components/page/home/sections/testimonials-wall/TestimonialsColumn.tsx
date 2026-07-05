"use client";

import { motion } from "framer-motion";
import { TestimonialCard } from "./TestimonialCard";
import type { TestimonialType } from "./testimonials-wall.types";

interface TestimonialsColumnProps {
  testimonials: TestimonialType[];
  direction?: "up" | "down";
  duration?: number;
  className?: string;
}

export function TestimonialsColumn({
  testimonials,
  direction = "up",
  duration = 40,
  className,
}: TestimonialsColumnProps) {
  // Duplicate array 3 times to ensure completely seamless infinite scrolling.
  // The motion div will animate from 0% to -33.33% (or vice versa).
  const extendedTestimonials = [...testimonials, ...testimonials, ...testimonials];

  const yStart = direction === "up" ? "0%" : "-33.33%";
  const yEnd = direction === "up" ? "-33.33%" : "0%";

  return (
    <div className={`relative flex flex-col overflow-hidden ${className || ""}`}>
      <motion.div
        className="flex flex-col gap-6"
        animate={{
          y: [yStart, yEnd],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: duration,
        }}
      >
        {extendedTestimonials.map((testimonial, idx) => (
          <TestimonialCard key={idx} testimonial={testimonial} />
        ))}
      </motion.div>
    </div>
  );
}
