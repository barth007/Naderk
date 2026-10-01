'use client';

import { BlogListView } from '@/components/blog/BlogListView';

/**
 * Articles inside the dashboard.
 *
 * The dashboard widget's "View All" linked at /blog, the public marketing
 * site, so a logged-in patient lost the dashboard shell — sidebar, navbar and
 * their session context — just to read an article.
 */
export default function DashboardBlogPage() {
  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Health Articles</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Expert insights, patient guides, and the latest in eye care and wellness.
        </p>
      </div>
      <BlogListView basePath="/dashboard/blog" heading={false} />
    </div>
  );
}
