import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchBlogs, fetchBlogBySlug, fetchCategories } from './cms.api';

export const useBlogs = (params?: { page?: number; search?: string; category?: string; featured?: boolean }) => {
  return useQuery({
    queryKey: ['blogs', params],
    queryFn: () => fetchBlogs(params),
  });
};

export const useInfiniteBlogs = (params?: { search?: string; category?: string; featured?: boolean }) => {
  return useInfiniteQuery({
    queryKey: ['infinite-blogs', params],
    queryFn: ({ pageParam = 1 }) => fetchBlogs({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.next) {
        return allPages.length + 1;
      }
      return undefined;
    },
  });
};

export const useBlogBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['blog', slug],
    queryFn: () => fetchBlogBySlug(slug),
    enabled: !!slug,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['blogCategories'],
    queryFn: fetchCategories,
  });
};
