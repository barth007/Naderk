export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface BlogAuthor {
  id: number;
  first_name: string;
  last_name: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  image_url: string | null;
  image_public_id?: string;
  published_at: string;
  is_featured: boolean;
  reading_time: string;
  category: BlogCategory;
  author: BlogAuthor;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  views_count: number;
  shares_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedBlogResponse {
  success: boolean;
  message: string;
  data: {
    count: number;
    next: string | null;
    previous: string | null;
    results: BlogPost[];
  }
}

export interface BlogDetailResponse {
  success: boolean;
  message: string;
  data: BlogPost;
}

export interface CategoryResponse {
  success: boolean;
  message: string;
  data: {
    results: BlogCategory[];
  }
}
