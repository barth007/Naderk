import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 md:h-12 w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E03E3E] disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-10",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
          ref={ref}
          onClick={(e) => {
            if (type === 'date') {
              try {
                if ('showPicker' in HTMLInputElement.prototype) {
                  (e.target as HTMLInputElement).showPicker();
                }
              } catch (err) {
                // Ignore if showPicker is not supported or not allowed
              }
            }
            props.onClick?.(e);
          }}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }

export function FormField({ label, htmlFor, children }: { label: string, htmlFor?: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>}
      {children}
    </div>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  )
)
Label.displayName = "Label"

export const Switch = () => <div />;
export const FieldMessage = () => <div />;
export type SwitchProps = any;
export type FieldMessageProps = any;
export type FormFieldProps = any;
export type LabelProps = any;
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;
