import type { ReactNode } from "react"

// ── Dropdown item ────────────────────────────────────────────

export interface NavDropdownItem {
  label: string
  href: string
  description?: string
  icon?: ReactNode
  isFeatured?: boolean
}

// ── Single nav item ──────────────────────────────────────────

export interface NavItem {
  label: string
  href: string
  /** When true, renders a chevron and a dropdown panel */
  hasDropdown?: boolean
  dropdown?: NavDropdownItem[]
}

// ── CTA button config ────────────────────────────────────────

export type CTAVariant = "soft" | "solid"

export interface CTAButton {
  label: string
  href: string
  variant: CTAVariant
}

// ── Navbar component props ───────────────────────────────────

export interface NavbarProps {
  /** Override default nav items */
  items?: NavItem[]
  /** Override default CTA buttons */
  ctas?: CTAButton[]
  /** Make navbar sticky (position: sticky; top: 0) */
  sticky?: boolean
  /** Override logo src (defaults to /naderk_logo.png) */
  logoSrc?: string
  /** Override logo alt text */
  logoAlt?: string
  /** Extra classes on the outer <header> */
  className?: string
}

// ── Internal subcomponent props ──────────────────────────────

export interface NavLinkProps {
  item: NavItem
  isActive: boolean
  onClick?: () => void
}

export interface MobileNavProps {
  id?: string
  items: NavItem[]
  ctas: CTAButton[]
  activePath: string
  isOpen: boolean
  onClose: () => void
}
