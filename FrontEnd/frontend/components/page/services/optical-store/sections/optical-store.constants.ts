import type { OpticalStoreContent } from "./optical-store.types";

export const OPTICAL_STORE_CONTENT: OpticalStoreContent = {
  hero: {
    badge: "New Collections 2026",
    title: "Crystal Clear Vision, Timeless Style.",
    description: "Explore our curated collection of designer frames. Get 20% off on your first pair with a valid prescription.",
    primaryCTA: { label: "Shop Now", href: "#trending" },
    secondaryCTA: { label: "Upload Prescription", href: "#upload" },
    image: "/images/prescription-glasses.png",
  },
  categories: [
    { id: 1, title: "Men", image: "/images/home-consultation.png", href: "/coming-soon" },
    { id: 2, title: "Women", image: "/images/eye-care-exam.png", href: "/coming-soon" },
    { id: 3, title: "Kids", image: "/images/image 11.png", href: "/coming-soon" },
  ],
  products: [
    {
      id: 1,
      brand: "Ray-ban",
      title: "Classic Wayfarer",
      price: 25000,
      colors: 4,
      image: "/images/image 13.png",
      badge: "BESTSELLER",
      category: "Men",
    },
    {
      id: 2,
      brand: "Oakley",
      title: "Holbrook",
      price: 18500,
      colors: 6,
      image: "/images/image 11.png",
      badge: "NEW",
      category: "Men",
    },
    {
      id: 3,
      brand: "Prada",
      title: "Cinema",
      price: 45000,
      colors: 2,
      image: "/images/image 13.png",
      badge: "TRENDING",
      category: "Women",
    },
    {
      id: 4,
      brand: "Gucci",
      title: "Cat Eye",
      price: 52000,
      colors: 3,
      image: "/images/image 11.png",
      category: "Women",
    },
  ],
  prescription: {
    title: "Have a prescription?",
    description: "Upload your prescription directly and our experts will ensure your lenses are crafted to perfection. We accept all major insurance providers.",
    features: [
      "Digital lens mapping technology",
      "Anti-reflective coating included",
      "2 years scratch resistant warranty",
    ],
  },
  brands: ["Ray-Ban", "Gucci", "Prada", "Oakley", "Warby-Parker"],
};
