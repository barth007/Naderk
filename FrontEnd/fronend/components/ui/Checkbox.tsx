import * as React from "react"
import { cn } from "../../lib/utils"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
  }

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            className={cn(
              "peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 accent-[#E03E3E] focus:ring-[#E03E3E] disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500",
              className
            )}
            ref={ref}
            {...props}
          />
          {label && <span className="text-sm font-medium leading-none text-gray-700">{label}</span>}
        </label>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
