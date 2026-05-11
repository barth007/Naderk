"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TestimonialCard } from "./TestimonialCard";
import { TESTIMONIALS } from "./testimonials.constants";

export function TestimonialsTrack() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const updateConstraints = () => {
      if (containerRef.current && trackRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const trackWidth = trackRef.current.scrollWidth;
        
        // Only allow dragging left if the track is wider than the container
        const leftConstraint = containerWidth - trackWidth - 32; // 32px for right padding/margin
        setDragConstraints({
          left: Math.min(leftConstraint, 0),
          right: 0,
        });
      }
    };

    updateConstraints();
    
    // Use a small timeout to ensure fonts/images load before final calc
    const timeoutId = setTimeout(updateConstraints, 500);
    
    window.addEventListener("resize", updateConstraints);
    return () => {
      window.removeEventListener("resize", updateConstraints);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full overflow-hidden px-4 py-8 md:px-6"
    >
      <motion.div
        ref={trackRef}
        className="flex gap-6 md:gap-8 w-max items-stretch"
        drag="x"
        dragConstraints={dragConstraints}
        dragElastic={0.15}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {TESTIMONIALS.map((testimonial, idx) => (
          <motion.div
            key={idx}
            whileHover={!isDragging ? { scale: 1.02, y: -4 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="shrink-0 flex"
          >
            <TestimonialCard testimonial={testimonial} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
