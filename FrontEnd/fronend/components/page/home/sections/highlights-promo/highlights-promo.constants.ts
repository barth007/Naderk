import type { HighlightFeatureType, PromoCardType } from "./highlights-promo.types";

export const HIGHLIGHTS: HighlightFeatureType[] = [
  {
    title: "Experienced Doctors",
    description: "Top-tier specialists with decades of combined experience in ocular health.",
    icon: "users",
  },
  {
    title: "Modern Equipments",
    description: "State of the art diagnostic and surgical technology for precise treatments.",
    icon: "microscope",
  },
  {
    title: "Trusted Care",
    description: "Over 50,000 satisfied patients and 4.9/5 rating for our services.",
    icon: "shield",
  },
];

export const PROMO_CARDS: PromoCardType[] = [
  {
    title: "Book refraction test from home",
    description: "Skip the commute and wait time. Book your consultation from home.",
    image: "/images/home-consultation.png",
    cta: {
      label: "Book Consultation",
      href: "/coming-soon",
    },
  },
  {
    title: "Custom prescription glasses.",
    description: "Premium frames meets precision led technology. Find your perfect pair.",
    image: "/images/prescription-glasses.png",
    cta: {
      label: "Browse Frames",
      href: "/coming-soon",
    },
  },
];
