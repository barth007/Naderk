import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  StoreCategory, Product, Frame, LensType, LensOption,
  Prescription, Cart, Wishlist, Order
} from './marketplace.types';

// Categories
export const useCategories = () => {
  return useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/categories/');
      return response.data.data as StoreCategory[];
    }
  });
};

// Products
export interface ProductFilterParams {
  category_slug?: string;
  search?: string;
  sort_by?: string;
}

export const useProducts = (params?: ProductFilterParams) => {
  return useQuery({
    queryKey: ['marketplace-products', params],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/products/', { params });
      return response.data.data as Product[];
    }
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['marketplace-product', id],
    queryFn: async () => {
      const response = await apiClient.get(`/marketplace/products/${id}/`);
      return response.data.data as Product;
    },
    enabled: !!id
  });
};

// Frames
export const useFrames = (search?: string) => {
  return useQuery({
    queryKey: ['marketplace-frames', search],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/frames/', {
        params: search ? { search } : undefined
      });
      return response.data.data as Frame[];
    }
  });
};

export const useFrame = (id: string) => {
  return useQuery({
    queryKey: ['marketplace-frame', id],
    queryFn: async () => {
      const response = await apiClient.get(`/marketplace/frames/${id}/`);
      return response.data.data as Frame;
    },
    enabled: !!id
  });
};

// Lens Options
export const useLensTypes = () => {
  return useQuery({
    queryKey: ['marketplace-lens-types'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/lens-types/');
      return response.data.data as LensType[];
    }
  });
};

export const useLensOptions = () => {
  return useQuery({
    queryKey: ['marketplace-lens-options'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/lens-options/');
      return response.data.data as LensOption[];
    }
  });
};

// Prescriptions
export const usePrescriptions = (patientId?: string) => {
  return useQuery({
    queryKey: ['marketplace-prescriptions', patientId],
    queryFn: async () => {
      const url = patientId ? `/marketplace/prescriptions/?patient_id=${patientId}` : '/marketplace/prescriptions/';
      const response = await apiClient.get(url);
      return response.data.data as Prescription[];
    }
  });
};

export const useReusablePrescriptions = () => {
  return useQuery({
    queryKey: ['marketplace-prescriptions-reusable'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/prescriptions/reusable/');
      return response.data.data as Prescription[];
    }
  });
};

export const usePrescription = (id: string) => {
  return useQuery({
    queryKey: ['marketplace-prescription', id],
    queryFn: async () => {
      const response = await apiClient.get(`/marketplace/prescriptions/${id}/`);
      return response.data.data as Prescription;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Keep polling while the prescription is awaiting or under review
      if (status === 'PENDING_REVIEW' || status === 'UNDER_REVIEW') return 5000;
      return false;
    },
  });
};

export const usePrescriptionReviewQueue = () => {
  return useQuery({
    queryKey: ['marketplace-prescription-review-queue'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/prescriptions/review-queue/');
      return response.data.data as Prescription[];
    }
  });
};

export interface PrescriptionPayload {
  patient_id?: string;
  right_sph?: number | null;
  right_cyl?: number | null;
  right_axis?: number | null;
  right_add?: number | null;
  left_sph?: number | null;
  left_cyl?: number | null;
  left_axis?: number | null;
  left_add?: number | null;
  pupillary_distance: number;
  near_pd?: number | null;
  segment_height?: number | null;
  fitting_height?: number | null;
  prescription_file?: string | null;
}

export const useSubmitPrescription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PrescriptionPayload) => {
      const response = await apiClient.post('/marketplace/prescriptions/', payload);
      return response.data.data as Prescription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescriptions-reusable'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescription-review-queue'] });
    }
  });
};

export interface ReviewPrescriptionPayload {
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REQUIRES_CORRECTION' | 'REJECTED';
  review_notes?: string;
}

export const useReviewPrescription = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReviewPrescriptionPayload) => {
      const response = await apiClient.post(`/marketplace/prescriptions/${id}/review/`, payload);
      return response.data.data as Prescription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescriptions-reusable'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescription-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-prescription', id] });
    }
  });
};

// Cart
export const useCart = () => {
  return useQuery({
    queryKey: ['marketplace-cart'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/cart/');
      return response.data.data as Cart;
    }
  });
};

export interface AddToCartPayload {
  product_id?: string | null;
  product_variant_id?: string | null;
  frame_variant_id?: string | null;
  lens_type_id?: string | null;
  lens_option_ids?: string[];
  prescription_id?: string | null;
  quantity?: number;
}

export const useAddToCart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddToCartPayload) => {
      const response = await apiClient.post('/marketplace/cart/add/', payload);
      return response.data.data as Cart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-cart'] });
    }
  });
};

export interface UpdateCartQuantityPayload {
  item_id: string;
  quantity: number;
}

export const useUpdateCartQuantity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateCartQuantityPayload) => {
      const response = await apiClient.post('/marketplace/cart/update-quantity/', payload);
      return response.data.data as Cart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-cart'] });
    }
  });
};

export const useRemoveFromCart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiClient.post('/marketplace/cart/remove/', { item_id: itemId });
      return response.data.data as Cart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-cart'] });
    }
  });
};

export const useClearCart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/marketplace/cart/clear/');
      return response.data.data as Cart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-cart'] });
    }
  });
};

// Wishlist
export const useWishlist = () => {
  return useQuery({
    queryKey: ['marketplace-wishlist'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/wishlist/');
      return response.data.data as Wishlist;
    }
  });
};

export interface ToggleWishlistPayload {
  product_id?: string | null;
  frame_variant_id?: string | null;
}

export const useToggleWishlist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ToggleWishlistPayload) => {
      const response = await apiClient.post('/marketplace/wishlist/toggle/', payload);
      return response.data.data as Wishlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-wishlist'] });
    }
  });
};

// Checkout & Orders
export interface CheckoutPayload {
  shipping_address: string;
  payment_reference?: string | null;
}

export const useCheckout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      const response = await apiClient.post('/marketplace/checkout/', payload);
      return response.data.data as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-cart'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
    }
  });
};

export const useOrders = () => {
  return useQuery({
    queryKey: ['marketplace-orders'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/orders/');
      return response.data.data as Order[];
    }
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: ['marketplace-order', id],
    queryFn: async () => {
      const response = await apiClient.get(`/marketplace/orders/${id}/`);
      return response.data.data as Order;
    },
    enabled: !!id
  });
};

export interface PayOrderPayload {
  payment_reference: string;
}

export const usePayOrder = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PayOrderPayload) => {
      const response = await apiClient.post(`/marketplace/orders/${id}/pay/`, payload);
      return response.data.data as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-order', id] });
    }
  });
};

export const useOrderReviewQueue = () => {
  return useQuery({
    queryKey: ['marketplace-order-review-queue'],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/orders/review-queue/');
      return response.data.data as Order[];
    }
  });
};

export interface ReviewOrderPayload {
  action: 'approve' | 'reject';
  notes?: string;
}

export const useReviewOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, ...payload }: ReviewOrderPayload & { orderId: string }) => {
      const response = await apiClient.post(`/marketplace/orders/${orderId}/review/`, payload);
      return response.data.data as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-order-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
    }
  });
};
