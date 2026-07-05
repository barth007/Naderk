import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind classes safely.
 * Handles conditional classes (clsx) and resolves conflicting
 * Tailwind utilities (tailwind-merge).
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-primary text-primary-foreground")
 *   cn("rounded-lg", className)  // override from parent
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
