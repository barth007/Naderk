import { apiClient } from '@/lib/api';
import { PaginatedBlogResponse, BlogDetailResponse, CategoryResponse } from './cms.types';

export const fetchBlogs = async (params?: { page?: number; search?: string; category?: string; featured?: boolean }) => {
  const response = await apiClient.get<PaginatedBlogResponse>('/cms/blogs/', { params });
  return response.data;
};

export const fetchBlogBySlug = async (slug: string) => {
  const response = await apiClient.get<BlogDetailResponse>(`/cms/blogs/${slug}/`);
  return response.data;
};

export const fetchCategories = async () => {
  const response = await apiClient.get<CategoryResponse>('/cms/categories/');
  return response.data;
};
