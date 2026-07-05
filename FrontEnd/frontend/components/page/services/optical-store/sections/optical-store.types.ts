export interface Product {
  id: number;
  brand: string;
  title: string;
  price: number;
  colors: number;
  image: string;
  badge?: string;
  category: string;
}

export interface Category {
  id: number;
  title: string;
  image: string;
  href: string;
}

export interface OpticalStoreContent {
  hero: {
    badge: string;
    title: string;
    description: string;
    primaryCTA: { label: string; href: string };
    secondaryCTA: { label: string; href: string };
    image: string;
  };
  categories: Category[];
  products: Product[];
  prescription: {
    title: string;
    description: string;
    features: string[];
  };
  brands: string[];
}
