import { getSiteBrand } from '@/lib/site-brand';
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


/**
 * The same article, kept inside the dashboard shell.
 *
 * Reading one from the dashboard widget used to send the patient to the public
 * marketing site, losing the sidebar and navbar entirely.
 */
export default async function DashboardBlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const brand = await getSiteBrand();
  const { slug } = await params;
  const blog = await getBlog(slug);

  if (!blog) {
    notFound();
  }

  const relatedBlogs = await getRelatedBlogs(blog.category.slug);
  const filteredRelated = relatedBlogs.filter(b => b.id !== blog.id).slice(0, 3);

  return (
    <BlogArticleView
      blog={blog}
      filteredRelated={filteredRelated}
      brand={brand}
      basePath="/dashboard/blog"
    />
  );
}
