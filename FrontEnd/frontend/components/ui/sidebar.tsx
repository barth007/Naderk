"use client"

import { cn } from "@/lib/cn"
import type { HTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react"

/*
  Semantic token usage:
  - Sidebar bg:          bg-sidebar       (--sidebar)
  - Sidebar text:        text-sidebar-foreground (--sidebar-foreground)
  - Sidebar border:      border-[var(--sidebar-border)]
  - Active item:         bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]
  - Hover item:          hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]
  - Section header text: text-muted-foreground
  All tokens update automatically when dark mode is toggled.
*/

// ── Sidebar Root ─────────────────────────────────────────────

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  collapsed?: boolean
  width?: string
}

export function Sidebar({
  collapsed = false,
  width = "16rem",
  className,
  children,
  ...props
}: SidebarProps) {
  return (
    <aside
      style={{ width: collapsed ? "3.5rem" : width }}
      className={cn(
        "flex flex-col h-full",
        "bg-sidebar text-sidebar-foreground",
        "border-r border-[var(--sidebar-border)]",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        className
      )}
      aria-expanded={!collapsed}
      {...props}
    >
      {children}
    </aside>
  )
}

// ── Sidebar Header ───────────────────────────────────────────

export function SidebarHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-5 border-b border-[var(--sidebar-border)] shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Sidebar Content (scrollable nav area) ────────────────────

export function SidebarContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto py-3", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Sidebar Footer ───────────────────────────────────────────

export function SidebarFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-3 py-3 border-t border-[var(--sidebar-border)] shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Sidebar Section ──────────────────────────────────────────

export interface SidebarSectionProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
}

export function SidebarSection({
  title,
  className,
  children,
  ...props
}: SidebarSectionProps) {
  return (
    <div className={cn("px-3 mb-2", className)} {...props}>
      {title && (
        <p className="px-2 mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground select-none">
          {title}
        </p>
      )}
      <nav aria-label={title}>{children}</nav>
    </div>
  )
}

// ── Sidebar Item ─────────────────────────────────────────────

export interface SidebarItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean
  icon?: ReactNode
  badge?: ReactNode
  /** Render as a different element (e.g. next/link) */
  as?: "a" | React.ElementType
}

export function SidebarItem({
  active = false,
  icon,
  badge,
  className,
  children,
  as: Tag = "a",
  ...props
}: SidebarItemProps) {
  return (
    <Tag
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)]",
        "text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-[var(--sidebar-ring)]",
        active
          ? [
              "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]",
            ]
          : [
              "text-sidebar-foreground",
              "hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
            ],
        className
      )}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      {icon && (
        <span className="shrink-0 h-4 w-4 flex items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {badge && <span className="ml-auto shrink-0">{badge}</span>}
    </Tag>
  )
}

// Needed for "as" prop type
import type React from "react"

/* ── Usage example ─────────────────────────────────────────────
  const HomeIcon = () => <svg>...</svg>

  <div className="flex h-screen">
    <Sidebar>
      <SidebarHeader>
        <span className="font-bold text-lg">Naderk</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection title="Main">
          <SidebarItem active icon={<HomeIcon />} href="/">
            Dashboard
          </SidebarItem>
          <SidebarItem icon={<UsersIcon />} href="/users" badge={<Badge variant="info" size="xs">3</Badge>}>
            Users
          </SidebarItem>
        </SidebarSection>
        <SidebarSection title="Settings">
          <SidebarItem icon={<SettingsIcon />} href="/settings">
            Settings
          </SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <SidebarItem icon={<LogOutIcon />} href="/logout">
          Sign out
        </SidebarItem>
      </SidebarFooter>
    </Sidebar>
    <main className="flex-1 p-6 bg-background">…</main>
  </div>
──────────────────────────────────────────────────────────────── */
