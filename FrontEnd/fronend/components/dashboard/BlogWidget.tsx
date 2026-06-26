"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteBlogs } from '@/services/cms/cms.hooks';
import { useInView } from 'react-intersection-observer';

export function BlogWidget() {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteBlogs();

  const { ref, inView } = useInView();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const scrollPositionRef = useRef(0);
  const requestRef = useRef<number | null>(null);

  // Flatten the pages array into a single list of blogs
  const blogs = data?.pages.flatMap(page => page.data.results) || [];

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Auto-scroll logic for Desktop
  useEffect(() => {
    // Only auto-scroll if we have enough items to scroll and are not hovering
    const container = scrollContainerRef.current;
    if (!container) return;

    // A simple check for desktop: viewport width > 768px
    const isDesktop = window.innerWidth > 768;
    if (!isDesktop) return;

    const scrollStep = () => {
      if (container && !isHovered) {
        // Increment scroll position
        scrollPositionRef.current += 0.5; // Adjust speed here (pixels per frame)

        // Apply scroll position
        container.scrollTop = scrollPositionRef.current;

        // If we've reached the bottom, we might need to reset or just let it trigger next page
        // If there's no next page and we hit bottom, maybe reset to top
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
          if (!hasNextPage && !isFetchingNextPage) {
            // Reset to top to loop if we reached the absolute end
            scrollPositionRef.current = 0;
            container.scrollTop = 0;
          }
        }
      }
      requestRef.current = requestAnimationFrame(scrollStep);
    };

    requestRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isHovered, hasNextPage, isFetchingNextPage]);

  // Sync manual scrolling with our ref position so it doesn't snap back
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  return (
    <section className="space-y-4 flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold text-gray-900 mb-1">Health Care News & Tips</h2>
        <Link href="/blog" className="text-xs font-semibold text-[#E03E3E] hover:underline">View All</Link>
      </div>

      {/* 
        Scrollable Container Wrapper with Gradient Fades
      */}
      <div className="relative h-[320px]">
        {/* Top Fade */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="h-full overflow-y-auto space-y-4 no-scrollbar pr-1"
        >
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-5 rounded-md border border-gray-100 shadow-sm space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              ))}
            </>
          ) : blogs.length > 0 ? (
            <>
              {blogs.map((blog) => (
                <Link
                  key={blog.id}
                  href={`/blog/${blog.slug}`}
                  className="block bg-white p-5 rounded-md border border-gray-100 shadow-sm space-y-2 cursor-pointer hover:border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{blog.category.name}</span>
                    <span className="text-[10px] font-medium text-gray-400">{blog.reading_time}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{blog.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{blog.excerpt}</p>
                  <span className="text-[#E03E3E] text-xs font-semibold mt-1 inline-block">Read Article &rarr;</span>
                </Link>
              ))}

              {/* Loading / End indicator */}
              <div ref={ref} className="py-4 text-center">
                {isFetchingNextPage ? (
                  <div className="text-xs text-gray-400 animate-pulse">Loading more...</div>
                ) : !hasNextPage ? (
                  <div className="text-xs text-gray-300">You've caught up!</div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm text-center">
              <p className="text-sm text-gray-500">No healthcare articles available.</p>
            </div>
          )}
        </div>

        {/* Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  );
}
