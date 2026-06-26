export interface CarouselSlideData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;          // Main background/product image URL
  mobileImage?: string;   // Mobile optimized banner image
  ctaText?: string;       // Call-to-action text
  ctaLink?: string;       // Call-to-action target link
  badge?: string;         // E.g., "Special Deal", "Limited Offer"
  discount?: string;      // E.g., "50% OFF", "Save $40"
  backgroundColor?: string; // Custom background gradient/styling class
  theme?: "light" | "dark";  // Dictates text color palette for readability
}
