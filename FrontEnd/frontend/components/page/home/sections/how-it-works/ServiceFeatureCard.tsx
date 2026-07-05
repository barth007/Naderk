import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import type { ServiceFeatureType } from "./how-it-works.types";

interface ServiceFeatureCardProps {
  service: ServiceFeatureType;
  className?: string;
}

export function ServiceFeatureCard({ service, className }: ServiceFeatureCardProps) {
  return (
    <Card 
      className={cn(
        "group transition-all hover:shadow-md",
        className
      )}
      shadow="sm"
    >
      <div className="flex items-center gap-4 p-4 lg:p-5">
        <AnimatedIcon name={service.icon} size={24} className="text-[#E53E3E] shrink-0" />
        <span className="font-medium text-foreground">{service.title}</span>
      </div>
    </Card>
  );
}
