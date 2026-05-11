import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PromoCardType } from "./highlights-promo.types";

interface PromoCardProps {
  promo: PromoCardType;
  className?: string;
}

export function PromoCard({ promo, className }: PromoCardProps) {
  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-[24px] flex flex-col min-h-[380px] md:min-h-[440px]",
        className
      )}
    >
      <Image
        src={promo.image}
        alt={promo.title}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      
      <div className="relative flex flex-1 flex-col justify-end p-8 md:p-10 z-10">
        <h3 className="mb-3 text-3xl font-bold text-white max-w-[320px]">
          {promo.title}
        </h3>
        <p className="mb-8 text-lg text-white/90 max-w-[360px]">
          {promo.description}
        </p>
        <div>
          <Link 
            href={promo.cta.href}
            className="btn bg-white text-[#E53E3E] border-white hover:bg-gray-100 hover:border-gray-100 font-semibold rounded-md px-8 shadow-sm"
          >
            {promo.cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
