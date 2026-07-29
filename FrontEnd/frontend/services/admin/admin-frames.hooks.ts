import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Frame, FrameGender, FrameRimType, FrameSizeCategory } from '@/services/marketplace/marketplace.types';

export const GENDERS: { value: FrameGender; label: string }[] = [
  { value: 'MEN', label: 'Men' },
  { value: 'WOMEN', label: 'Women' },
  { value: 'UNISEX', label: 'Unisex' },
  { value: 'KIDS', label: 'Kids' },
];
export const RIM_TYPES: { value: FrameRimType; label: string }[] = [
  { value: 'FULL_RIM', label: 'Full Rim' },
  { value: 'SEMI_RIMLESS', label: 'Semi-Rimless' },
  { value: 'RIMLESS', label: 'Rimless' },
];
export const SIZE_CATEGORIES: { value: FrameSizeCategory; label: string }[] = [
  { value: 'NARROW', label: 'Narrow' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'WIDE', label: 'Wide' },
];
export const FRAME_SHAPES = ['Rectangle', 'Square', 'Round', 'Oval', 'Cat-Eye', 'Aviator', 'Wayfarer', 'Browline', 'Geometric'];
export const FRAME_MATERIALS = ['Acetate', 'Metal', 'Titanium', 'TR90', 'Stainless Steel', 'Plastic', 'Mixed'];

export interface FrameVariantInput {
  color: string;
  size: string;
  quantity_available: number;
  low_stock_threshold?: number;
  sku?: string;
}

export interface FramePayload {
  name: string;
  brand: string;
  style: string;
  material: string;
  base_price: string;
  gender: FrameGender;
  rim_type: FrameRimType;
  size_category: FrameSizeCategory;
  description?: string;
  features?: string;
  lens_width?: number | null;
  bridge_width?: number | null;
  temple_length?: number | null;
  lens_height?: number | null;
  total_width?: number | null;
  weight_grams?: number | null;
  images?: string[];
  variants?: FrameVariantInput[];
}

const BASE = '/dashboard/admin/frames/';

export const useAdminFrames = () =>
  useQuery({
    queryKey: ['admin-frames'],
    queryFn: async () => {
      const res = await apiClient.get(BASE);
      return res.data.data as Frame[];
    },
  });

export const useAdminCreateFrame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FramePayload) => apiClient.post(BASE, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-frames'] }),
  });
};

export const useAdminUpdateFrame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<FramePayload> & { id: string }) =>
      apiClient.patch(`${BASE}${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-frames'] }),
  });
};

export const useAdminToggleFrame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`${BASE}${id}/toggle/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-frames'] }),
  });
};

export const useAdminDeleteFrame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-frames'] }),
  });
};
