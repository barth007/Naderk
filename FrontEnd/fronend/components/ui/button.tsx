import { cn } from "@/lib/cn"
import type { ButtonHTMLAttributes } from "react"

/*
  Semantic token usage:
  - "btn"            → DaisyUI base (uses --color-base-*, --radius-field)
  - "btn-primary"    → DaisyUI (uses --color-primary, --color-primary-content)
  - "btn-secondary"  → DaisyUI (uses --color-secondary, --color-secondary-content)
  - "btn-ghost"      → DaisyUI (hover: --color-base-200)
  - "btn-destructive"→ custom: bg-destructive + text-destructive-foreground
  - "btn-outline"    → DaisyUI outlined variant
  - "btn-ghost"      → transparent with hover bg
  - sizes map to DaisyUI btn-xs/sm/md/lg/xl
*/

const variantMap = {
  primary:     "btn btn-primary",
  secondary:   "btn btn-secondary",
  accent:      "btn btn-accent",
  ghost:       "btn btn-ghost",
  outline:     "btn btn-outline",
  neutral:     "btn btn-neutral",
  destructive: "btn bg-destructive text-destructive-foreground hover:opacity-90 border-0",
  link:        "btn btn-link",
} as const

const sizeMap = {
  xs:  "btn-xs",
  sm:  "btn-sm",
  md:  "",
  lg:  "btn-lg",
  xl:  "btn-xl",
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantMap
  size?: keyof typeof sizeMap
  loading?: boolean
  wide?: boolean
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  wide = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        variantMap[variant],
        sizeMap[size],
        wide && "btn-wide",
        loading && "btn-disabled",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}

/* ── Usage examples ────────────────────────────────────────────
  <Button>Save</Button>
  <Button variant="secondary">Cancel</Button>
  <Button variant="destructive">Delete account</Button>
  <Button variant="outline" size="sm">View details</Button>
  <Button loading>Processing…</Button>
  <Button variant="ghost" size="lg" wide>Browse catalog</Button>
──────────────────────────────────────────────────────────────── */
