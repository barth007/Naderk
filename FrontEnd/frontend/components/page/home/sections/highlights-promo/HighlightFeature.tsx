import { cn } from "@/lib/cn";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import type { HighlightFeatureType } from "./highlights-promo.types";

interface HighlightFeatureProps {
  feature: HighlightFeatureType;
  className?: string;
}

export function HighlightFeature({ feature, className }: HighlightFeatureProps) {
  return (
    <div className={cn("flex flex-col items-center text-center gap-4", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-sm">
        <AnimatedIcon name={feature.icon} size={32} />
      </div>
      <div>
        <h3 className="mb-2 text-xl font-bold text-white">{feature.title}</h3>
        <p className="text-sm leading-relaxed text-white/90 max-w-[280px] mx-auto">
          {feature.description}
        </p>
      </div>
    </div>
  );
}
