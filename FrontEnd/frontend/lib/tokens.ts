/**
 * NADERK DESIGN TOKENS — TypeScript Map
 *
 * Type-safe references to every CSS custom property.
 * Use these in:
 *   - Inline styles:       style={{ backgroundColor: tokens.background }}
 *   - CSS-in-JS:           `background: ${tokens.primary}`
 *   - Chart configs:       colors: [tokens.chart1, tokens.chart2, ...]
 *   - Animation libraries: { color: tokens.foreground }
 *
 * These are CSS variable *references* (e.g. "var(--primary)") so
 * they resolve dynamically at runtime in the browser, respecting
 * the active theme (.dark / data-theme).
 */

const v = (name: string) => `var(--${name})` as const

// ── Surfaces ────────────────────────────────────────────────
export const tokens = {
  background:          v("background"),
  foreground:          v("foreground"),

  card:                v("card"),
  cardForeground:      v("card-foreground"),

  popover:             v("popover"),
  popoverForeground:   v("popover-foreground"),

  // ── Brand colors ────────────────────────────────────────
  primary:             v("primary"),
  primaryForeground:   v("primary-foreground"),

  secondary:           v("secondary"),
  secondaryForeground: v("secondary-foreground"),

  muted:               v("muted"),
  mutedForeground:     v("muted-foreground"),

  accent:              v("accent"),
  accentForeground:    v("accent-foreground"),

  destructive:         v("destructive"),
  destructiveForeground: v("destructive-foreground"),

  // ── Border / Input ───────────────────────────────────────
  border:              v("border"),
  input:               v("input"),
  inputBackground:     v("input-background"),
  switchBackground:    v("switch-background"),
  ring:                v("ring"),

  // ── Charts ───────────────────────────────────────────────
  chart1:              v("chart-1"),
  chart2:              v("chart-2"),
  chart3:              v("chart-3"),
  chart4:              v("chart-4"),
  chart5:              v("chart-5"),

  /** Ordered array for chart libraries (Chart.js, Recharts, etc.) */
  chartPalette:        [v("chart-1"), v("chart-2"), v("chart-3"), v("chart-4"), v("chart-5")],

  // ── Radius ───────────────────────────────────────────────
  radius:    v("radius"),
  radiusXs:  v("radius-xs"),
  radiusSm:  v("radius-sm"),
  radiusMd:  v("radius-md"),
  radiusLg:  v("radius-lg"),
  radiusXl:  v("radius-xl"),
  radius2xl: v("radius-2xl"),
  radiusFull: v("radius-full"),

  // ── Sidebar ──────────────────────────────────────────────
  sidebar:                   v("sidebar"),
  sidebarForeground:         v("sidebar-foreground"),
  sidebarPrimary:            v("sidebar-primary"),
  sidebarPrimaryForeground:  v("sidebar-primary-foreground"),
  sidebarAccent:             v("sidebar-accent"),
  sidebarAccentForeground:   v("sidebar-accent-foreground"),
  sidebarBorder:             v("sidebar-border"),
  sidebarRing:               v("sidebar-ring"),

  // ── Typography ───────────────────────────────────────────
  fontSans: v("font-sans"),
  fontMono: v("font-mono"),

  // ── Shadows ──────────────────────────────────────────────
  shadowXs: v("shadow-xs"),
  shadowSm: v("shadow-sm"),
  shadowMd: v("shadow-md"),
  shadowLg: v("shadow-lg"),
  shadowXl: v("shadow-xl"),

  // ── Transitions ──────────────────────────────────────────
  transitionFast:   v("transition-fast"),
  transitionBase:   v("transition-base"),
  transitionSlow:   v("transition-slow"),
  transitionSlower: v("transition-slower"),
} as const

export type TokenKey = keyof typeof tokens

/**
 * Look up a token value by its key.
 * Useful in dynamic/conditional contexts.
 */
export const getToken = (key: Exclude<TokenKey, "chartPalette">): string =>
  tokens[key] as string

/**
 * Build an inline style object mapping multiple properties to tokens.
 * @example
 *   style={withTokens({ color: 'foreground', background: 'card' })}
 */
export const withTokens = (
  map: Partial<Record<keyof React.CSSProperties, TokenKey>>
): React.CSSProperties =>
  Object.fromEntries(
    Object.entries(map).map(([prop, key]) => [prop, tokens[key as TokenKey]])
  ) as React.CSSProperties

// Needed for withTokens type signature
import type React from "react"
