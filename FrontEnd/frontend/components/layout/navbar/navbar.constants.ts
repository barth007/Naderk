import type { NavItem, CTAButton } from "./navbar.types"

/**
 * Default navigation items.
 * Override by passing `items` prop to <Navbar />.
 */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "About",
    href: "/about",
  },
  {
    label: "Services",
    href: "/services",
    hasDropdown: true,
    dropdown: [
      {
        label: "Laboratory / Diagnostics",
        href: "/services/laboratory",
        isFeatured: true,
      },
      {
        label: "Marketplace",
        href: "/dashboard/marketplace",
      },
      {
        label: "Telehealth / Virtual Care",
        href: "/services/telehealth",
      },
      {
        label: "Extend Life Africa",
        href: "/extend-life-africa",
      },
    ],
  },
  {
    label: "Extend Life Africa",
    href: "/extend-life-africa",
  },
  {
    label: "Contact",
    href: "/contact",
  },
]

/**
 * Default CTA buttons.
 * Override by passing `ctas` prop to <Navbar />.
 */
export const DEFAULT_CTA_BUTTONS: CTAButton[] = [
  {
    label: "Get Started",
    href: "/register",
    variant: "soft",
  },
  {
    label: "Support Us",
    // Straight to the gift form on the Extend Life Africa page.
    href: "/extend-life-africa#give",
    variant: "solid",
  },
]

/** Height of the navbar in px — used to offset sticky content */
export const NAVBAR_HEIGHT = 72
