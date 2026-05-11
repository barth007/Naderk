import { cn } from "@/lib/cn"
import type { HTMLAttributes } from "react"

/*
  Semantic token usage:
  - Outer card:     bg-card        (--card)
  - Text:           text-card-foreground (--card-foreground)
  - Border:         border-border  (--border)
  - Shadow:         uses --shadow-sm / --shadow-md via CSS var
  - Header divider: border-border
*/

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  shadow?: "none" | "sm" | "md" | "lg"
  bordered?: boolean
}

export function Card({
  shadow = "sm",
  bordered = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "card bg-card text-card-foreground rounded-[var(--radius-lg)]",
        bordered && "border border-border",
        shadow !== "none" && `shadow-[var(--shadow-${shadow})]`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-6 py-5 border-b border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-sm text-muted-foreground mt-1",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-5", className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-6 py-4 border-t border-border bg-muted/40 rounded-b-[var(--radius-lg)] flex items-center gap-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ── Usage example ─────────────────────────────────────────────
  <Card>
    <CardHeader>
      <CardTitle>Account settings</CardTitle>
      <CardDescription>Manage your profile and preferences.</CardDescription>
    </CardHeader>
    <CardContent>
      <p>Content goes here.</p>
    </CardContent>
    <CardFooter>
      <Button size="sm">Save changes</Button>
      <Button variant="ghost" size="sm">Cancel</Button>
    </CardFooter>
  </Card>
──────────────────────────────────────────────────────────────── */
