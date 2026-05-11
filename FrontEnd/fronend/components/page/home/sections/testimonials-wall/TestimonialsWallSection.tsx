import Link from "next/link";
import { TestimonialsColumn } from "./TestimonialsColumn";
import { COLUMN_1_TESTIMONIALS, COLUMN_2_TESTIMONIALS } from "./testimonials-wall.constants";

export function TestimonialsWallSection() {
  return (
    <section className="bg-background py-16 md:py-24 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-8 items-center">
          
          {/* Left Side: Content */}
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center rounded-full bg-[#FCE8E8] px-4 py-1.5 text-xs font-medium text-[#E53E3E]">
              Patient Stories
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl max-w-lg">
              We believe in restoring clear vision.
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground md:text-lg max-w-xl mb-4">
              At NaderkEye, our mission is built on patient trust, modern care, and transformational experiences. Our goal is to create a service that you're absolutely satisfied with, ensuring your world remains a clearer place.
            </p>
            <Link
              href="/coming-soon"
              className="btn bg-[#E53E3E] !text-white hover:bg-[#D32F2F] border-[#E53E3E] hover:border-[#D32F2F] font-semibold rounded-md px-8 shadow-sm transition-all"
            >
              Read More Testimonials
            </Link>
          </div>

          {/* Right Side: Animated Wall */}
          <div className="relative h-[450px] md:h-[550px] w-full max-w-2xl mx-auto rounded-[2rem] bg-white p-6 lg:p-8 overflow-hidden shadow-xl border border-border">
            {/* Soft background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#E53E3E]/5 via-transparent to-blue-500/5 opacity-50" />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full relative z-10">
              <TestimonialsColumn 
                testimonials={COLUMN_1_TESTIMONIALS} 
                direction="up" 
                duration={35} 
              />
              {/* Hide second column on very small mobile if it feels too cramped, but standard is to show both on sm+ */}
              <TestimonialsColumn 
                testimonials={COLUMN_2_TESTIMONIALS} 
                direction="down" 
                duration={45} 
                className="hidden sm:flex"
              />
            </div>

            {/* Fade Overlays to hide card edges smoothly */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-white to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-white to-transparent" />
          </div>

        </div>
      </div>
    </section>
  );
}
