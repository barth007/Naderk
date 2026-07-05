import { AnimatedIconName } from "@/components/ui/AnimatedIcon";

export interface HighlightFeatureType {
  title: string;
  description: string;
  icon: AnimatedIconName;
}

export interface PromoCardType {
  title: string;
  description: string;
  image: string;
  cta: {
    label: string;
    href: string;
  };
}
