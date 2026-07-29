import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HeroSlide {
  id: number;
  badge_text: string;
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  cta_primary_text: string;
  cta_primary_link: string;
  cta_secondary_text: string;
  cta_secondary_link: string;
  discount_text: string;
  theme: 'LIGHT' | 'DARK';
  order: number;
  is_active: boolean;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  location: string;
  quote: string;
  rating: number;
  image_url: string;
  order: number;
  is_active: boolean;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  bio: string;
  image_url: string;
  twitter_url: string;
  linkedin_url: string;
  instagram_url: string;
  order: number;
  is_active: boolean;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  order: number;
  is_active: boolean;
}

export interface TrustMetric {
  id: number;
  label: string;
  value: string;
  icon: string;
  order: number;
  is_active: boolean;
}

export interface TrustedClient {
  id: number;
  name: string;
  logo_url: string;
  website: string;
  order: number;
  is_active: boolean;
}

export interface SiteSettings {
  id: number;
  company_name: string;
  logo_url: string;
  favicon_url: string;
  phone_primary: string;
  phone_secondary: string;
  email_support: string;
  email_general: string;
  address: string;
  google_maps_url: string;
  hours_weekday: string;
  hours_saturday: string;
  hours_sunday: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  linkedin_url: string;
  updated_at: string;
}

// ── Hero Slides ──────────────────────────────────────────────────────────────

export const useHeroSlides = () =>
  useQuery({
    queryKey: ['cms-hero-slides'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/hero-slides/');
      return res.data.data.results as HeroSlide[];
    },
  });

export const useCreateHeroSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<HeroSlide, 'id'>) => apiClient.post('/cms/hero-slides/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-hero-slides'] }),
  });
};

export const useUpdateHeroSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: HeroSlide) => apiClient.put(`/cms/hero-slides/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-hero-slides'] }),
  });
};

export const useDeleteHeroSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/hero-slides/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-hero-slides'] }),
  });
};

// ── Testimonials ─────────────────────────────────────────────────────────────

export const useTestimonials = () =>
  useQuery({
    queryKey: ['cms-testimonials'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/testimonials/');
      return res.data.data.results as Testimonial[];
    },
  });

export const useCreateTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Testimonial, 'id'>) => apiClient.post('/cms/testimonials/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-testimonials'] }),
  });
};

export const useUpdateTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Testimonial) => apiClient.put(`/cms/testimonials/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-testimonials'] }),
  });
};

export const useDeleteTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/testimonials/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-testimonials'] }),
  });
};

// ── Team Members ─────────────────────────────────────────────────────────────

export const useTeamMembers = () =>
  useQuery({
    queryKey: ['cms-team'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/team/');
      return res.data.data.results as TeamMember[];
    },
  });

export const useCreateTeamMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TeamMember, 'id'>) => apiClient.post('/cms/team/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-team'] }),
  });
};

export const useUpdateTeamMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: TeamMember) => apiClient.put(`/cms/team/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-team'] }),
  });
};

export const useDeleteTeamMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/team/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-team'] }),
  });
};

// ── FAQs ─────────────────────────────────────────────────────────────────────

export const useFAQs = () =>
  useQuery({
    queryKey: ['cms-faqs'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/faqs/');
      return res.data.data.results as FAQ[];
    },
  });

export const useCreateFAQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<FAQ, 'id'>) => apiClient.post('/cms/faqs/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-faqs'] }),
  });
};

export const useUpdateFAQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: FAQ) => apiClient.put(`/cms/faqs/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-faqs'] }),
  });
};

export const useDeleteFAQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/faqs/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-faqs'] }),
  });
};

// ── Trust Metrics ────────────────────────────────────────────────────────────

export const useTrustMetrics = () =>
  useQuery({
    queryKey: ['cms-trust-metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/trust-metrics/');
      return res.data.data.results as TrustMetric[];
    },
  });

export const useCreateTrustMetric = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TrustMetric, 'id'>) => apiClient.post('/cms/trust-metrics/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-trust-metrics'] }),
  });
};

export const useUpdateTrustMetric = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: TrustMetric) => apiClient.put(`/cms/trust-metrics/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-trust-metrics'] }),
  });
};

export const useDeleteTrustMetric = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/trust-metrics/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-trust-metrics'] }),
  });
};

// ── Trusted Clients ──────────────────────────────────────────────────────────

export const useTrustedClients = () =>
  useQuery({
    queryKey: ['cms-trusted-clients'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/trusted-clients/');
      return res.data.data.results as TrustedClient[];
    },
  });

export const useCreateTrustedClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TrustedClient, 'id'>) => apiClient.post('/cms/trusted-clients/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-trusted-clients'] }),
  });
};

export const useUpdateTrustedClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: TrustedClient) => apiClient.put(`/cms/trusted-clients/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-trusted-clients'] }),
  });
};

export const useDeleteTrustedClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/trusted-clients/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-trusted-clients'] }),
  });
};

// ── Site Settings ────────────────────────────────────────────────────────────

export const useSiteSettings = () =>
  useQuery({
    queryKey: ['cms-site-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/site-settings/');
      return res.data.data as SiteSettings | null;
    },
  });

export const useUpdateSiteSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SiteSettings>) => apiClient.put('/cms/site-settings/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-site-settings'] }),
  });
};

// ── Blog Categories (admin write) ────────────────────────────────────────────

export interface BlogCategoryAdmin {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export const useAdminCategories = () =>
  useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/categories/');
      return res.data.data.results as BlogCategoryAdmin[];
    },
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post('/cms/categories/create/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['blogCategories'] });
    },
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description?: string }) =>
      apiClient.put(`/cms/categories/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['blogCategories'] });
    },
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/categories/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['blogCategories'] });
    },
  });
};

// ── Blog Authoring ───────────────────────────────────────────────────────────

export interface BlogAuthorPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image_url: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  is_featured: boolean;
  reading_time: string;
  published_at: string | null;
  category: { id: number; name: string; slug: string } | null;
  author: { id: number; first_name: string; last_name: string } | null;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  title: string;
  content: string;
  excerpt?: string;
  image_url?: string;
  category_id?: number | null;
  is_featured?: boolean;
  status?: 'DRAFT' | 'PUBLISHED';
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
}

export const useMyBlogs = () =>
  useQuery({
    queryKey: ['my-blogs'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/blogs/my/');
      return res.data.data.results as BlogAuthorPost[];
    },
  });

export const useAllBlogsAdmin = () =>
  useQuery({
    queryKey: ['admin-all-blogs'],
    queryFn: async () => {
      const res = await apiClient.get('/cms/blogs/all/');
      return res.data.data.results as BlogAuthorPost[];
    },
  });

export const useCreateBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BlogPostInput) => apiClient.post('/cms/blogs/create/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-blogs'] });
      qc.invalidateQueries({ queryKey: ['admin-all-blogs'] });
      qc.invalidateQueries({ queryKey: ['cms-blogs'] });
    },
  });
};

export const useUpdateBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: BlogPostInput & { id: number }) =>
      apiClient.put(`/cms/blogs/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-blogs'] });
      qc.invalidateQueries({ queryKey: ['admin-all-blogs'] });
      qc.invalidateQueries({ queryKey: ['cms-blogs'] });
    },
  });
};

export const useDeleteBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cms/blogs/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-blogs'] });
      qc.invalidateQueries({ queryKey: ['admin-all-blogs'] });
      qc.invalidateQueries({ queryKey: ['cms-blogs'] });
    },
  });
};

export const usePublishBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/cms/blogs/${id}/publish/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-blogs'] });
      qc.invalidateQueries({ queryKey: ['admin-all-blogs'] });
      qc.invalidateQueries({ queryKey: ['cms-blogs'] });
    },
  });
};

export const useDraftBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/cms/blogs/${id}/draft/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-blogs'] });
      qc.invalidateQueries({ queryKey: ['admin-all-blogs'] });
      qc.invalidateQueries({ queryKey: ['cms-blogs'] });
    },
  });
};

// ── Convenience hook — returns the two brand fields used across layout components
export const useBrand = () => {
  const { data: settings } = useSiteSettings();
  return {
    name: settings?.company_name || 'NaderkEye Care',
    logoUrl: settings?.logo_url || null,
  };
};
