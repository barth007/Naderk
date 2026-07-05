'use client';

import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  min,
  max,
  className,
  disabled,
}: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'relative flex items-center border border-gray-200 rounded-md bg-gray-50 focus-within:bg-white focus-within:border-[#E03E3E] transition-colors cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={() => !disabled && inputRef.current?.showPicker?.()}
    >
      <Calendar className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none shrink-0" />
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full pl-9 pr-3 py-2 text-xs font-semibold text-gray-800 bg-transparent outline-none cursor-pointer',
          // hide the default browser calendar icon
          '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer',
          !value && 'text-gray-400'
        )}
      />
    </div>
  );
}
