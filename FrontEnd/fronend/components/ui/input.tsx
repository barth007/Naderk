import { cn } from "@/lib/cn"
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  HTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"

/*
  Semantic token usage:
  - Input bg:           bg-[var(--input-background)]  (--input-background)
  - Input border:       border-border                  (--border)
  - Focused ring:       ring-ring                      (--ring)
  - Placeholder text:   text-muted-foreground          (--muted-foreground)
  - Label text:         text-foreground                (--foreground)
  - Error text/border:  text-destructive / border-destructive
  - Helper text:        text-muted-foreground
  - DaisyUI "input":    picks up --radius-field, --border, --color-base-content
*/

// ── Label ───────────────────────────────────────────────────

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "block text-sm font-medium text-foreground mb-1.5",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive ml-1" aria-hidden="true">*</span>
      )}
    </label>
  )
}

// ── Helper / Error text ─────────────────────────────────────

export function FieldMessage({
  error,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { error?: boolean }) {
  return (
    <p
      className={cn(
        "text-xs mt-1.5",
        error ? "text-destructive" : "text-muted-foreground",
        className
      )}
      role={error ? "alert" : undefined}
      {...props}
    >
      {children}
    </p>
  )
}

// ── Input ───────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        // DaisyUI base (radius-field, sizing, typography)
        "input w-full",
        // Token-based colors
        "bg-[var(--input-background)] text-foreground",
        "border border-border",
        "placeholder:text-muted-foreground",
        // Focus ring via CSS variable
        "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-0",
        "transition-[box-shadow,border-color] duration-150",
        // Error state
        error && "border-destructive focus:ring-destructive",
        className
      )}
      aria-invalid={error}
      {...props}
    />
  )
}

// ── Textarea ────────────────────────────────────────────────

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "textarea w-full min-h-[80px] resize-y",
        "bg-[var(--input-background)] text-foreground",
        "border border-border",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-0",
        "transition-[box-shadow,border-color] duration-150",
        error && "border-destructive focus:ring-destructive",
        className
      )}
      aria-invalid={error}
      {...props}
    />
  )
}

// ── Select ──────────────────────────────────────────────────

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "select w-full",
        "bg-[var(--input-background)] text-foreground",
        "border border-border",
        "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-0",
        "transition-[box-shadow,border-color] duration-150",
        error && "border-destructive focus:ring-destructive",
        className
      )}
      aria-invalid={error}
      {...props}
    >
      {children}
    </select>
  )
}

// ── Checkbox ────────────────────────────────────────────────

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        "checkbox",
        "border-border",
        "checked:bg-primary checked:border-primary",
        className
      )}
      {...props}
    />
  )
}

// ── Switch ──────────────────────────────────────────────────

export interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        "toggle",
        "bg-[var(--switch-background)] border-border",
        "checked:bg-primary checked:border-primary",
        className
      )}
      role="switch"
      {...props}
    />
  )
}

// ── FormField (Label + Input + Message) ─────────────────────

export interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  required,
  error,
  hint,
  htmlFor,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <FieldMessage error>{error}</FieldMessage>
      ) : hint ? (
        <FieldMessage>{hint}</FieldMessage>
      ) : null}
    </div>
  )
}

// Needed for FormField JSX
import type React from "react"

/* ── Usage examples ────────────────────────────────────────────
  <FormField label="Email" required htmlFor="email" hint="We'll never share your email.">
    <Input id="email" type="email" placeholder="you@example.com" />
  </FormField>

  <FormField label="Password" required htmlFor="pw" error="Must be at least 8 characters.">
    <Input id="pw" type="password" error />
  </FormField>

  <FormField label="Role" htmlFor="role">
    <Select id="role">
      <option value="">Select a role</option>
      <option value="admin">Admin</option>
      <option value="user">User</option>
    </Select>
  </FormField>

  <FormField label="Enable notifications">
    <Switch defaultChecked />
  </FormField>
──────────────────────────────────────────────────────────────── */
