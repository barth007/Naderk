export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
}

export interface ProductVariant {
  id: string;
  product: string;
  variant_name: string;
  sku?: string;
  quantity_available: number;
  low_stock_threshold: number;
  price_modifier: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  category_name: string;
  category_slug: string;
  price: string;
  images: string[];
  quantity_available: number;
  low_stock_threshold: number;
  is_active: boolean;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface FrameVariant {
  id: string;
  frame: string;
  color: string;
  size: string;
  quantity_available: number;
  low_stock_threshold: number;
  sku?: string;
  is_active: boolean;
}

export interface Frame {
  id: string;
  name: string;
  brand: string;
  style: string;
  material: string;
  base_price: string;
  front_image?: string;
  transparent_overlay_png?: string;
  is_active: boolean;
  variants: FrameVariant[];
  created_at: string;
  updated_at: string;
}

export interface LensType {
  id: string;
  name: string;
  description: string;
  price_modifier: string;
  is_active: boolean;
}

export interface LensOption {
  id: string;
  name: string;
  price_modifier: string;
  is_active: boolean;
}

export interface Prescription {
  id: string;
  patient: string;
  patient_email: string;
  right_sph?: number;
  right_cyl?: number;
  right_axis?: number;
  right_add?: number;
  left_sph?: number;
  left_cyl?: number;
  left_axis?: number;
  left_add?: number;
  pupillary_distance: number;
  near_pd?: number;
  segment_height?: number;
  fitting_height?: number;
  prescription_file?: string;
  status: 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REQUIRES_CORRECTION' | 'REJECTED';
  status_display: string;
  expires_at?: string;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionReview {
  id: string;
  prescription: string;
  reviewed_by?: string;
  reviewed_by_email?: string;
  review_notes?: string;
  reviewed_at?: string;
}

export interface PrescriptionActivity {
  id: string;
  prescription: string;
  actor?: string;
  actor_email?: string;
  action: string;
  metadata: any;
  created_at: string;
}

export interface CartItem {
  id: string;
  cart: string;
  product?: string;
  product_detail?: Product;
  product_variant?: string;
  product_variant_detail?: ProductVariant;
  frame_variant?: string;
  frame_variant_detail?: FrameVariant;
  frame_detail?: Frame;
  lens_type?: string;
  lens_type_detail?: LensType;
  lens_options: string[];
  lens_options_detail?: LensOption[];
  prescription?: string;
  prescription_detail?: Prescription;
  price: string;
  quantity: number;
}

export interface Cart {
  id: string;
  user: string;
  items: CartItem[];
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  wishlist: string;
  product?: string;
  product_detail?: Product;
  frame_variant?: string;
  frame_variant_detail?: FrameVariant;
  frame_detail?: Frame;
  created_at: string;
}

export interface Wishlist {
  id: string;
  user: string;
  items: WishlistItem[];
}

export interface OrderItem {
  id: string;
  order: string;
  product?: string;
  product_detail?: Product;
  product_variant?: string;
  product_variant_detail?: ProductVariant;
  frame_variant?: string;
  frame_variant_detail?: FrameVariant;
  frame_detail?: Frame;
  lens_type?: string;
  lens_type_detail?: LensType;
  lens_options: string[];
  lens_options_detail?: LensOption[];
  prescription?: string;
  prescription_snapshot?: any;
  price: string;
  quantity: number;
}

export interface OrderActivity {
  id: string;
  order: string;
  actor?: string;
  actor_email?: string;
  action: string;
  metadata: any;
  created_at: string;
}

export interface Order {
  id: string;
  user: string;
  status: 'PENDING' | 'PAID' | 'PRESCRIPTION_REVIEW' | 'FRAME_RESERVED' | 'IN_PRODUCTION' | 'LENS_CUTTING' | 'FRAME_ASSEMBLY' | 'QUALITY_CHECK' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  status_display: string;
  payment_status: 'UNPAID' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  payment_status_display: string;
  total_price: string;
  shipping_address: string;
  payment_reference?: string;
  production_notes?: string;
  internal_notes?: string;
  items: OrderItem[];
  activities: OrderActivity[];
  created_at: string;
  updated_at: string;
}
