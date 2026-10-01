import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Editable marketing copy for the public pages.
 *
 * Page content lived in TypeScript constant files, so changing a headline or a
 * picture needed a developer and a deploy. Sections are stored as JSON against
 * a key, and the backend schema says what fields each one holds so the admin
 * can render a real form.
 */

export type PageFieldType = 'text' | 'textarea' | 'image' | 'list';

export interface PageField {
  name: string;
  label: string;
  type: PageFieldType;
  help?: string;
  /** Row shape, for `list` fields. */
  fields?: PageField[];
}

export interface PageSectionSchema {
  key: string;
  label: string;
  fields: PageField[];
  content: Record<string, unknown>;
  is_active: boolean;
}

export interface PageSchema {
  page: string;
  label: string;
  sections: PageSectionSchema[];
}

/** Public content, keyed by section. Pages fall back to their constants. */
export const usePageContent = (page: string) =>
  useQuery({
    queryKey: ['page-content', page],
    queryFn: async () => {
      const res = await apiClient.get(`/cms/pages/${page}/`);
      return res.data.data.sections as Record<string, Record<string, unknown>>;
    },
  });

export const usePageSchema = (page: string, enabled = true) =>
  useQuery({
    queryKey: ['page-schema', page],
    queryFn: async () => {
      const res = await apiClient.get(`/cms/pages/${page}/schema/`);
      return res.data.data as PageSchema;
    },
    enabled,
  });

export const useSavePageSection = (page: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionKey, content }: { sectionKey: string; content: Record<string, unknown> }) =>
      apiClient.put(`/cms/pages/${page}/sections/${sectionKey}/`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['page-schema', page] });
      // The public page reads a different key; drop it or the site keeps
      // serving the old copy until the cache expires.
      qc.invalidateQueries({ queryKey: ['page-content', page] });
    },
  });
};
