import Image from "next/image";

export function ContactHeroSection() {
  return (
    <section className="bg-background pt-24 pb-12 md:pt-32 md:pb-16 min-h-[697px] flex flex-col justify-center">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="flex flex-col items-center text-center gap-6 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center rounded-full bg-[#FCE8E8] px-4 py-1.5 text-xs font-medium text-[#E53E3E]">
            Speak with us
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Contact Our Specialists
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
            Expert eye care is just a message away. Reach out to our dedicated team for appointments, inquiries, or emergency vision care.
          </p>
        </div>

        {/* Hero Image */}
        <div className="relative w-full h-[400px] md:h-[500px] rounded-[2rem] overflow-hidden shadow-sm">
          <Image
            src="/images/home-consultation.png"
            alt="NaderkEye Specialist Team"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>
    </section>
  );
}
