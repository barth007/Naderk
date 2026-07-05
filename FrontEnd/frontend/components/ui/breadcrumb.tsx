import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutGrid } from 'lucide-react';

export function Breadcrumbs() {
  const pathname = usePathname();
  
  if (!pathname) return null;

  const paths = pathname.split('/').filter(Boolean);
  
  // Ex: ["dashboard", "profile"]
  // If we are exactly at /dashboard, no need to show breadcrumb or just show Dashboard
  if (paths.length === 1 && paths[0] === 'dashboard') {
    return null; // Or show something else if desired
  }

  return (
    <div className="w-full flex items-center gap-2 overflow-x-auto text-sm font-medium text-gray-500 whitespace-nowrap scrollbar-hide py-3">
      <Link href="/dashboard" className="hover:text-gray-900 mr-2 flex items-center gap-2">
        <LayoutGrid className="w-5 h-5" />
      </Link>
      
      {paths.map((path, index) => {
        // Skip the first "dashboard" since it's covered by the icon
        if (index === 0 && path === 'dashboard') return null;

        const isLast = index === paths.length - 1;
        const href = `/${paths.slice(0, index + 1).join('/')}`;
        
        // Format path string: capitalize first letter, replace hyphens
        const formattedPath = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');

        return (
          <React.Fragment key={path}>
            <ChevronRight className="w-4 h-4 text-gray-300 mx-1 shrink-0" />
            {isLast ? (
              <span className="text-[#E03E3E] capitalize">{formattedPath}</span>
            ) : (
              <Link href={href} className="hover:text-gray-900 capitalize">
                {formattedPath}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
