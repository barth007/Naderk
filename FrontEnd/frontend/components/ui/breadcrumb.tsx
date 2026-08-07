import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutGrid } from 'lucide-react';

/**
 * Paths that actually have a page.tsx and can therefore be linked to.
 *
 * The breadcrumb used to link every URL segment, but several segments are only
 * grouping folders around a dynamic route — `/dashboard/marketplace/product`
 * has no page, only `product/[id]` does. Clicking "Product" sent people to a
 * 404. Anything not listed here renders as plain text instead of a link.
 *
 * Keep in sync when adding routes; an unlisted route degrades to plain text,
 * which is safe (never a broken link), just not clickable.
 */
const NAVIGABLE_ROUTES = new Set<string>([
  '/dashboard',
  '/dashboard/appointments',
  '/dashboard/appointments/book',
  '/dashboard/cart',
  '/dashboard/checkout',
  '/dashboard/marketplace',
  '/dashboard/marketplace/optical-builder',
  '/dashboard/messages',
  '/dashboard/orders',
  '/dashboard/profile',
  '/dashboard/records',
  '/dashboard/telehealth',
  '/admin/appointments',
  '/admin/billing',
  '/admin/cms',
  '/admin/dashboard',
  '/admin/frames',
  '/admin/glasses-builder',
  '/admin/inventory',
  '/admin/inventory/new',
  '/admin/messages',
  '/admin/orders',
  '/admin/orders/review',
  '/admin/records',
  '/admin/services',
  '/admin/staff',
  '/doctor/blog',
  '/doctor/dashboard',
  '/doctor/messages',
  '/doctor/prescriptions',
  '/doctor/records',
  '/doctor/telehealth',
  '/agent/chats',
  '/agent/dashboard',
  '/agent/telehealth',
  '/optician/dashboard',
  '/blog',
]);

/** UUIDs and long opaque ids should never be shown to a user as a page name. */
const looksLikeId = (segment: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
  /^\d+$/.test(segment) ||
  (segment.length > 18 && !segment.includes('-'));

const titleCase = (segment: string) =>
  segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export interface BreadcrumbsProps {
  /**
   * Human labels for segments that would otherwise render as an opaque id, e.g.
   * `{ [product.id]: product.name }`. Detail pages should pass this so the trail
   * reads "Marketplace › Product › Vitamin A" rather than a raw UUID.
   */
  labels?: Record<string, string>;
}

export function Breadcrumbs({ labels }: BreadcrumbsProps = {}) {
  const pathname = usePathname();

  if (!pathname) return null;

  const paths = pathname.split('/').filter(Boolean);

  // At the section root there is nothing to trail back to.
  if (paths.length === 1 && paths[0] === 'dashboard') return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full flex items-center gap-2 overflow-x-auto text-sm font-medium text-gray-500 whitespace-nowrap no-scrollbar py-3"
    >
      <Link href="/dashboard" className="hover:text-gray-900 mr-2 flex items-center gap-2" aria-label="Dashboard">
        <LayoutGrid className="w-5 h-5" />
      </Link>

      {paths.map((segment, index) => {
        // The leading "dashboard" is represented by the icon above.
        if (index === 0 && segment === 'dashboard') return null;

        const isLast = index === paths.length - 1;
        const href = `/${paths.slice(0, index + 1).join('/')}`;

        const label =
          labels?.[segment] ?? (looksLikeId(segment) ? 'Details' : titleCase(segment));

        // Link only when the target really exists — otherwise plain text, so a
        // grouping segment can never navigate to a 404.
        const isNavigable = !isLast && NAVIGABLE_ROUTES.has(href);

        return (
          <React.Fragment key={`${segment}-${index}`}>
            <ChevronRight className="w-4 h-4 text-gray-300 mx-1 shrink-0" />
            {isLast ? (
              <span className="text-[#E03E3E]" aria-current="page">{label}</span>
            ) : isNavigable ? (
              <Link href={href} className="hover:text-gray-900">{label}</Link>
            ) : (
              <span className="text-gray-400">{label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
