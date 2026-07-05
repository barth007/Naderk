import { TestimonialsTrack } from "./TestimonialsTrack";

export function TestimonialsDragSection() {
  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-32">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute left-[-10%] top-10 h-[400px] w-[400px] rounded-full bg-[#E53E3E]/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-10 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[120px]" />

      <div className="container mx-auto px-4 md:px-6 mb-12 relative z-10">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Trusted by thousands
          </h2>
          <p className="text-lg text-muted-foreground">
            Hear directly from our patients about their experiences and how we've helped them see the world more clearly.
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px]">
        <TestimonialsTrack />
      </div>
    </section>
  );
}
