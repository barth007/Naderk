import Image from "next/image";
import { ServiceFeatureCard } from "./ServiceFeatureCard";
import { SERVICES } from "./how-it-works.constants";

export function ServicesOverview() {
  return (
    <div className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4">
            Complete Eye Care Services
          </h2>
          <p className="text-lg text-muted-foreground">
            Experts care for every vision need, from routine checkups to advanced surgical procedures.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {SERVICES.map((service, index) => (
            <ServiceFeatureCard key={index} service={service} />
          ))}
        </div>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl lg:aspect-auto lg:h-[500px]">
        <Image
          src="/images/eye-care-exam.png"
          alt="Eye doctor examining a patient"
          fill
          className="object-cover transition-transform duration-500 hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
    </div>
  );
}
