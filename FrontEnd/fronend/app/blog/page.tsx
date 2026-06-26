"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useBlogs, useCategories } from '@/services/cms/cms.hooks';
import { ChevronRight, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BlogIndexPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const { data: blogsResponse, isLoading: isLoadingBlogs } = useBlogs(
    selectedCategory ? { category: selectedCategory } : undefined
  );
  
  const { data: categoriesResponse } = useCategories();
  
  const blogs = blogsResponse?.data?.results || [];
  const categories = categoriesResponse?.data?.results || [];

  return (
    <div className="w-full min-h-screen bg-gray-50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Healthcare News & <span className="text-[#E03E3E]">Tips</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Expert insights, patient guides, and the latest news in eye care and wellness.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Categories Filter */}
        <div className="flex flex-wrap gap-3 mb-10 justify-center">
          <Button
            variant={selectedCategory === '' ? "default" : "outline"}
            className={selectedCategory === '' ? "bg-[#E03E3E] text-white hover:bg-[#c93636] border-none" : "border-gray-200 text-gray-600 hover:bg-gray-50"}
            onClick={() => setSelectedCategory('')}
          >
            All Topics
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.slug ? "default" : "outline"}
              className={selectedCategory === cat.slug ? "bg-[#E03E3E] text-white hover:bg-[#c93636] border-none" : "border-gray-200 text-gray-600 hover:bg-gray-50"}
              onClick={() => setSelectedCategory(cat.slug)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Blog Grid */}
        {isLoadingBlogs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
                <div className="h-48 bg-gray-200 w-full" />
                <div className="p-6 space-y-4">
                  <div className="flex gap-2 mb-2">
                    <div className="h-4 bg-gray-200 rounded w-16" />
                    <div className="h-4 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                  <div className="h-4 bg-gray-200 rounded w-4/6" />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.map((blog) => (
              <Link href={`/blog/${blog.slug}`} key={blog.id} className="group flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="relative h-56 w-full overflow-hidden bg-gray-100">
                  {blog.image_url ? (
                    <img 
                      src={blog.image_url} 
                      alt={blog.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-gray-900 rounded-full shadow-sm">
                      {blog.category.name}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-6">
                  <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mb-3">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(blog.published_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {blog.reading_time}</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-[#E03E3E] transition-colors">{blog.title}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
                    {blog.excerpt}
                  </p>
                  <div className="flex items-center text-[#E03E3E] text-sm font-semibold mt-auto">
                    Read Article <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">No articles found</h3>
            <p className="text-gray-500">We couldn't find any healthcare articles for this category.</p>
            <Button 
              className="mt-6 bg-[#E03E3E] hover:bg-[#c93636] text-white"
              onClick={() => setSelectedCategory('')}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
