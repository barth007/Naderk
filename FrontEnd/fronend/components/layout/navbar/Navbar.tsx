"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import {
  DEFAULT_NAV_ITEMS,
  DEFAULT_CTA_BUTTONS,
} from "./navbar.constants"
import type {
  NavbarProps,
  NavItem,
  CTAButton,
  NavLinkProps,
  MobileNavProps,
} from "./navbar.types"

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Returns true when the given href should be considered active */
function isActivePath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

// ─────────────────────────────────────────────────────────────
// CTA Button — uses the shared Button component, no Link
// ─────────────────────────────────────────────────────────────

function NavCTAButton({
  label,
  href,
  variant,
  onNavigate,
}: CTAButton & { onNavigate?: () => void }) {
  const router = useRouter()
  return (
    <Button
      variant={variant === "solid" ? "destructive" : "ghost"}
      size="md"
      onClick={() => {
        onNavigate?.()
        router.push(href)
      }}
      className={cn(
        "rounded-md px-5 font-semibold",
        variant === "soft" &&
          "bg-[#fde8ec] text-[var(--destructive)] hover:bg-[#fbd1d9] border-0 hover:opacity-100"
      )}
    >
      {label}
    </Button>
  )
}

// ─────────────────────────────────────────────────────────────
// Dropdown menu
// ─────────────────────────────────────────────────────────────

function DropdownMenu({ item, isActive }: NavLinkProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "flex items-center gap-1 px-3 py-5 text-sm font-medium transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm",
          isActive || open
            ? "text-nav-link-active"
            : "text-nav-link hover:text-nav-link-active hover:opacity-100"
        )}
      >
        {item.label}
        {/* Chevron */}
        <svg
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {/* Active underline */}
        {isActive && (
          <span
            className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--destructive)]"
            aria-hidden
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            "absolute left-1/2 top-full z-50 mt-1 min-w-[220px] -translate-x-1/2",
            "border border-[var(--border)] bg-[var(--card)]",
            "shadow-[var(--shadow-lg)] py-0",
            "animate-in fade-in-0 slide-in-from-top-2 duration-150"
          )}
          role="menu"
        >
          {item.dropdown?.map((child) => {
            const childIsActive = isActivePath(child.href, pathname)
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setOpen(false)}
                role="menuitem"
                className={cn(
                  "flex flex-col gap-0.5 px-4 py-2.5 text-sm",
                  "transition-colors duration-100 focus-visible:outline-none",
                  childIsActive
                    ? "bg-[var(--muted)]"
                    : "hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)]"
                )}
              >
                <span
                  className={cn(
                    "font-medium",
                    childIsActive
                      ? "text-nav-link-active"
                      : "text-nav-link"
                  )}
                >
                  {child.label}
                </span>
                {child.description && (
                  <span className="text-xs leading-snug text-[var(--muted-foreground)]">
                    {child.description}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Desktop nav link (no dropdown)
// ─────────────────────────────────────────────────────────────

function DesktopNavLink({ item, isActive }: NavLinkProps) {
  return (
    <Link
      href={item.href}
      className={cn(
        "relative px-3 py-5 text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm",
        isActive
            ? "text-nav-link-active"
            : "text-nav-link hover:text-nav-link-active hover:opacity-100"
      )}
    >
      {item.label}
      {/* Animated active underline */}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--destructive)]",
          "transition-all duration-200",
          isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
        )}
        style={{ transformOrigin: "left" }}
      />
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Mobile navigation drawer
// ─────────────────────────────────────────────────────────────

function MobileNav({ id, items, ctas, activePath, isOpen, onClose }: MobileNavProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Close drawer on route change
  const pathname = usePathname()
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trap scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[min(320px,90vw)]",
          "bg-[var(--background)] shadow-[var(--shadow-xl)]",
          "flex flex-col transition-transform duration-300 ease-out lg:hidden",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <Image
              src="/naderk_logo.png"
              alt="Naderk logo"
              width={100}
              height={28}
              loading="eager"
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]",
              "transition-colors duration-150"
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" aria-label="Mobile navigation">
          {items.map((item) => {
            const active = isActivePath(item.href, activePath)
            if (item.hasDropdown && item.dropdown) {
              const isExpanded = openDropdown === item.label
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(isExpanded ? null : item.label)
                    }
                    aria-expanded={isExpanded}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium",
                      "transition-colors duration-100",
                      active
                        ? "text-nav-link-active bg-[var(--muted)]"
                        : "text-nav-link hover:text-nav-link-active hover:opacity-100 hover:bg-[var(--muted)]"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {active && (
                        <span className="h-4 w-0.5 rounded-full bg-[var(--destructive)]" aria-hidden />
                      )}
                      {item.label}
                    </span>
                    <svg
                      className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-[var(--border)] pl-3">
                      {item.dropdown.map((child) => {
                        const childActive = isActivePath(child.href, activePath)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={cn(
                              "block px-3 py-2 text-sm transition-colors duration-100",
                              childActive
                                ? "text-nav-link-active bg-[var(--muted)]"
                                : "text-nav-link hover:text-nav-link-active hover:opacity-100 hover:bg-[var(--muted)]"
                            )}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium",
                  "transition-colors duration-100",
                  active
                    ? "text-nav-link-active bg-[var(--muted)]"
                    : "text-nav-link hover:text-nav-link-active hover:opacity-100 hover:bg-[var(--muted)]"
                )}
              >
                {active && (
                  <span className="h-4 w-0.5 rounded-full bg-[var(--destructive)] shrink-0" aria-hidden />
                )}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* CTA buttons */}
        <div className="border-t border-[var(--border)] px-4 py-4 flex flex-col gap-2.5">
          {ctas.map((cta) => (
            <NavCTAButton key={`${cta.label}-${cta.href}`} {...cta} onNavigate={onClose} />
          ))}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Hamburger button
// ─────────────────────────────────────────────────────────────

function HamburgerButton({
  open,
  onClick,
}: {
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="mobile-nav"
      className={cn(
        "flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg",
        "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]",
        "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--ring)]",
        "lg:hidden"
      )}
    >
      <span
        className={cn(
          "h-[1.5px] w-5 rounded-full bg-current transition-all duration-200 origin-center",
          open && "rotate-45 translate-y-[6.5px]"
        )}
      />
      <span
        className={cn(
          "h-[1.5px] w-5 rounded-full bg-current transition-all duration-200",
          open && "opacity-0 scale-x-0"
        )}
      />
      <span
        className={cn(
          "h-[1.5px] w-5 rounded-full bg-current transition-all duration-200 origin-center",
          open && "-rotate-45 -translate-y-[6.5px]"
        )}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Navbar
// ─────────────────────────────────────────────────────────────

export function Navbar({
  items = DEFAULT_NAV_ITEMS,
  ctas = DEFAULT_CTA_BUTTONS,
  sticky = true,
  logoSrc = "/naderk_logo.png",
  logoAlt = "Naderk",
  className,
}: NavbarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Close mobile nav when viewport grows past mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <>
      <header
        className={cn(
          "w-full z-30 ",
          "bg-[var(--background)]",
          "border-b border-[var(--border)]",
          sticky && "sticky top-0",
          className
        )}
        style={{ height: 72 }}
      >
        <div className="navbar min-h-0 h-full  w-full max-w-7xl mx-auto gap-0">

          <div className="navbar-start ">
            <Link
              href="/"
              aria-label="Go to homepage"
              className={cn(
                "flex items-center focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm",
                "transition-opacity duration-150 hover:opacity-80"
              )}
            >
              <Image
                src={logoSrc}
                alt={logoAlt}
                width={75}
                height={50}
                loading="eager"
                className=" object-contain"
                priority
              />
            </Link>
          </div>

          {/* ── Center: Desktop nav ─────────────────────────── */}
          <nav
            aria-label="Main navigation"
            className="navbar-center hidden lg:flex items-stretch h-full"
          >
            <ul className="flex items-stretch gap-8 h-full list-none m-0 p-0" role="list">
              {items.map((item) => {
                const active = isActivePath(item.href, pathname)
                return (
                  <li key={item.label} className="flex items-stretch">
                    {item.hasDropdown ? (
                      <DropdownMenu item={item} isActive={active} />
                    ) : (
                      <DesktopNavLink item={item} isActive={active} />
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* ── Right: CTAs + hamburger ─────────────────────── */}
          <div className="navbar-end ml-auto flex items-center gap-2.5">
            {/* Desktop CTAs */}
            <div className="hidden lg:flex items-center gap-2.5">
              {ctas.map((cta) => (
                <NavCTAButton key={`${cta.label}-${cta.href}`} {...cta} />
              ))}
            </div>

            {/* Mobile hamburger */}
            <HamburgerButton
              open={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            />
          </div>
        </div>
      </header>

      {/* ── Mobile navigation drawer ─────────────────────────── */}
      <MobileNav
        id="mobile-nav"
        items={items}
        ctas={ctas}
        activePath={pathname}
        isOpen={mobileOpen}
        onClose={closeMobile}
      />
    </>
  )
}
