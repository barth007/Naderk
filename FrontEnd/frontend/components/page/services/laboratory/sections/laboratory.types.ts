import { AnimatedIconName } from "@/components/ui/AnimatedIcon";

export interface LabServiceCard {
  icon: AnimatedIconName;
  title: string;
  description: string;
}

export interface LabStandardFeature {
  icon: AnimatedIconName;
  title: string;
  description: string;
}

export interface LaboratoryContent {
  hero: {
    badge: string;
    title: string;
    description: string;
    primaryCTA: { label: string; href: string };
    secondaryCTA: { label: string; href: string };
    image: string;
    imageAlt: string;
  };
  overview: {
    title: string;
    description: string;
    services: LabServiceCard[];
  };
  portal: {
    title: string;
    description: string;
    buttonLabel: string;
    href: string;
  };
  standards: {
    title: string;
    description: string;
    features: LabStandardFeature[];
    images: { src: string; alt: string }[];
  };
}
