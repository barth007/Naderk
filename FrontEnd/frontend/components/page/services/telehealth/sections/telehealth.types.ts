import { AnimatedIconName } from "@/components/ui/AnimatedIcon";

export interface TelehealthStep {
  icon: AnimatedIconName;
  title: string;
  description: string;
}

export interface TelehealthRequirement {
  icon: AnimatedIconName;
  title: string;
  description: string;
}

export interface TelehealthContent {
  hero: {
    badge: string;
    title: string;
    description: string;
    primaryCTA: { label: string; href: string };
    secondaryCTA: { label: string; href: string };
    image: string;
    stats: string;
    avatars: string[];
  };
  steps: {
    title: string;
    description: string;
    items: TelehealthStep[];
  };
  technical: {
    title: string;
    description: string;
    requirements: TelehealthRequirement[];
    privacy: {
      title: string;
      description: string;
      features: string[];
    };
  };
  testimonial: {
    quote: string;
    author: string;
    role: string;
  };
  cta: {
    title: string;
    description: string;
    primaryCTA: { label: string; href: string };
    secondaryCTA: { label: string; href: string };
  };
}
