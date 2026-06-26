import { CarouselSlideData } from "./carousel.types";

export const CAROUSEL_SLIDES: CarouselSlideData[] = [
  {
    id: "eyewear-collection",
    title: "Designer Eyewear Collection",
    subtitle: "EXCLUSIVE OFFERS",
    description: "Discover our premium frames and designer styles. Get up to 40% OFF and a free comprehensive vision test with every purchase.",
    image: "/images/premium_eyewear_banner.png",
    mobileImage: "/images/premium_eyewear_banner.png",
    ctaText: "Shop the Collection",
    ctaLink: "/services/optical-store",
    badge: "NEW ARRIVALS",
    discount: "40% OFF",
    backgroundColor: "linear-gradient(135deg, #fdf8f5 0%, #faeae1 100%)",
    theme: "light"
  },
  {
    id: "telehealth-consults",
    title: "Virtual Eye Consultations",
    subtitle: "CLINICAL SUPPORT 24/7",
    description: "Speak with certified ophthalmologists and opticians from the comfort of your home. Video consultations start at just $29.",
    image: "/images/telehealth_banner.png",
    mobileImage: "/images/telehealth_banner.png",
    ctaText: "Book Consultation",
    ctaLink: "/services/telehealth",
    badge: "ONLINE CARE",
    discount: "FROM $29",
    backgroundColor: "linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%)",
    theme: "light"
  },
  {
    id: "pediatric-screenings",
    title: "Back to School Screenings",
    subtitle: "PEDIATRIC EYE HEALTH",
    description: "Prepare your children for classroom success. Make sure they see the board clearly with our custom kids' screening packages.",
    image: "/images/pediatric_screening_banner.png",
    mobileImage: "/images/pediatric_screening_banner.png",
    ctaText: "Schedule Screening",
    ctaLink: "/coming-soon",
    badge: "FAMILY SPECIAL",
    discount: "SAVE $50",
    backgroundColor: "linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%)",
    theme: "light"
  },
  {
    id: "retinal-diagnostics",
    title: "Retinal Screening & Imaging",
    subtitle: "PREVENTATIVE EYE HEALTH",
    description: "Early detection saves sight. Get high-definition retinal analysis for glaucoma, diabetic retinopathy, and macular health.",
    image: "/images/eye-care-exam.png",
    mobileImage: "/images/eye-care-exam.png",
    ctaText: "Book Diagnostics",
    ctaLink: "/services/laboratory",
    badge: "CLINICAL LEADERSHIP",
    discount: "HIPAA SECURE",
    backgroundColor: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
    theme: "light"
  }
];
