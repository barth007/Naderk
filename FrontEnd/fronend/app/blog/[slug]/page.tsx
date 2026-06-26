import { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { BlogPost, BlogDetailResponse, PaginatedBlogResponse } from '@/services/cms/cms.types';

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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const blog = await getBlog(params.slug);
  
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

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
  const blog = await getBlog(params.slug);

  if (!blog) {
    notFound();
  }

  const relatedBlogs = await getRelatedBlogs(blog.category.slug);
  // Filter out current blog and limit to 3
  const filteredRelated = relatedBlogs.filter(b => b.id !== blog.id).slice(0, 3);

  return (
    <article className="min-h-screen bg-white pb-20">
      
      {/* Header Image & Title */}
      <div className="relative w-full h-[50vh] min-h-[400px] bg-gray-900">
        {blog.image_url && (
          <img 
            src={blog.image_url} 
            alt={blog.title} 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16">
            <Link href="/blog" className="inline-flex items-center text-sm font-medium text-white/80 hover:text-white mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Articles
            </Link>
            
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="bg-[#E03E3E] text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full">
                {blog.category.name}
              </span>
              <span className="text-white/80 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {blog.reading_time}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {blog.title}
            </h1>
            
            <div className="flex items-center justify-between flex-wrap gap-4 border-t border-white/20 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold backdrop-blur-sm">
                  {blog.author.first_name[0]}{blog.author.last_name[0]}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">By {blog.author.first_name} {blog.author.last_name}</p>
                  <p className="text-white/60 text-xs flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" /> {new Date(blog.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              
              <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors" title="Share Article">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* We use Tailwind Typography plugin 'prose' for elegant rendering */}
        <div 
          className="prose prose-lg prose-gray max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-[#E03E3E] hover:prose-a:text-[#c93636] prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: blog.content?.replace(/\n/g, '<br />') || '' }} 
        />
        
        {/* Author Bio Section (Optional future expansion) */}
        <div className="mt-16 py-8 border-t border-gray-100 flex items-center gap-6">
           <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl shrink-0">
              {blog.author.first_name[0]}{blog.author.last_name[0]}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-lg mb-1">{blog.author.first_name} {blog.author.last_name}</h4>
              <p className="text-gray-500 text-sm">Healthcare professional and contributor at NaderkEye.</p>
            </div>
        </div>
      </div>

      {/* Related Posts */}
      {filteredRelated.length > 0 && (
        <div className="bg-gray-50 border-t border-gray-200 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-bold text-gray-900">More in {blog.category.name}</h2>
              <Link href="/blog" className="text-[#E03E3E] font-semibold hover:underline flex items-center">
                View All <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {filteredRelated.map((relatedBlog) => (
                <Link href={`/blog/${relatedBlog.slug}`} key={relatedBlog.id} className="group flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                    {relatedBlog.image_url && (
                      <img 
                        src={relatedBlog.image_url} 
                        alt={relatedBlog.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">{relatedBlog.reading_time}</span>
                    <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-[#E03E3E] transition-colors">{relatedBlog.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2">{relatedBlog.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
