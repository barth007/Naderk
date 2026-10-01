import { Metadata } from 'next';
import { getSiteBrand } from '@/lib/site-brand';
import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { BlogPost, BlogDetailResponse, PaginatedBlogResponse } from '@/services/cms/cms.types';
import { BlogArticleView } from '@/components/blog/BlogArticleView';

// Fetch function for Server Component
async function getBlog(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}/cms/blogs/${slug}/`, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    if (!res.ok) return null;
    const json: BlogDetailResponse = await res.json();
    return json.data;
  } catch (error) {
    return null;
  }
}

async function getRelatedBlogs(categorySlug: string): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}/cms/blogs/?category=${categorySlug}`, {
      next: { revalidate: 60 }
    });
    if (!res.ok) return [];
    const json: PaginatedBlogResponse = await res.json();
    return json.data.results;
  } catch (error) {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);
  
  if (!blog) {
    return {
      title: 'Article Not Found',
    };
  }

  const title = blog.meta_title || blog.title;
  const description = blog.meta_description || blog.excerpt;

  return {
    title,
    description,
    keywords: blog.meta_keywords,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: blog.published_at,
      authors: [`${blog.author.first_name} ${blog.author.last_name}`],
      images: blog.image_url ? [{ url: blog.image_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: blog.image_url ? [blog.image_url] : undefined,
    }
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const brand = await getSiteBrand();
  const { slug } = await params;
  const blog = await getBlog(slug);

  if (!blog) {
    notFound();
  }

  const relatedBlogs = await getRelatedBlogs(blog.category.slug);
  // Filter out current blog and limit to 3
  const filteredRelated = relatedBlogs.filter(b => b.id !== blog.id).slice(0, 3);

  return (
    <BlogArticleView
      blog={blog}
      filteredRelated={filteredRelated}
      brand={brand}
      basePath="/blog"
    />
  );
}
