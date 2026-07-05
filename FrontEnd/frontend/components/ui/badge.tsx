import { cn } from "@/lib/cn"
import type { HTMLAttributes } from "react"

/*
  Semantic token usage:
  - "badge-primary"     → DaisyUI (--color-primary, --color-primary-content)
  - "badge-secondary"   → DaisyUI (--color-secondary, --color-secondary-content)
  - "badge-accent"      → DaisyUI (--color-accent, --color-accent-content)
  - "badge-neutral"     → DaisyUI (--color-neutral, --color-neutral-content)
  - "badge-info"        → DaisyUI (--color-info)
  - "badge-success"     → DaisyUI (--color-success)
  - "badge-warning"     → DaisyUI (--color-warning)
  - "badge-error"       → DaisyUI (--color-error)
  - "badge-ghost"       → DaisyUI ghost badge
  - "badge-outline"     → DaisyUI outlined variant
  - muted:              → bg-muted text-muted-foreground (custom token class)
  - destructive:        → bg-destructive text-destructive-foreground
*/

const variantMap = {
  primary:     "badge badge-primary",
  secondary:   "badge badge-secondary",
  accent:      "badge badge-accent",
  neutral:     "badge badge-neutral",
  ghost:       "badge badge-ghost",
  outline:     "badge badge-outline",
  info:        "badge badge-info",
  success:     "badge badge-success",
  warning:     "badge badge-warning",
  error:       "badge badge-error",
  muted:       "badge bg-muted text-muted-foreground border-0",
  destructive: "badge bg-destructive text-destructive-foreground border-0",
} as const

const sizeMap = {
  xs: "badge-xs",
  sm: "badge-sm",
  md: "",
  lg: "badge-lg",
} as const

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantMap
  size?: keyof typeof sizeMap
}

export function Badge({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        variantMap[variant],
        sizeMap[size],
        "font-medium",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/* ── Usage examples ────────────────────────────────────────────
  <Badge>New</Badge>
  <Badge variant="success">Active</Badge>
  <Badge variant="destructive" size="sm">Failed</Badge>
  <Badge variant="warning">Pending</Badge>
  <Badge variant="outline">Draft</Badge>
  <Badge variant="muted" size="xs">Archived</Badge>
──────────────────────────────────────────────────────────────── */
