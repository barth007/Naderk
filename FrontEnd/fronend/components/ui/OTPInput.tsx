import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function OTPInput({ 
    length = 6, 
    value, 
    onChange, 
    onComplete,
    error,
    disabled = false
}: OTPInputProps) {
  const [activeInput, setActiveInput] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFocus = (index: number) => {
    setActiveInput(index);
    // Move cursor to the end of the input
    setTimeout(() => {
        if (inputRefs.current[index]) {
            inputRefs.current[index]?.setSelectionRange(1, 1);
        }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newValue = value.split('');
      
      if (value[index]) {
        // If current input has a value, delete it
        newValue[index] = '';
        onChange(newValue.join(''));
      } else if (index > 0) {
        // If current input is empty, delete previous and move focus
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(-1);
    
    if (val) {
      const newValue = value.split('');
      newValue[index] = val;
      const joinedValue = newValue.join('');
      onChange(joinedValue);

      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      } else if (joinedValue.length === length) {
        inputRefs.current[index]?.blur();
        if (onComplete) onComplete(joinedValue);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '').slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      if (pastedData.length === length && onComplete) {
          onComplete(pastedData);
      }
      
      const focusIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-2 sm:gap-3">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\\d*"
            maxLength={1}
            value={value[index] || ''}
            disabled={disabled}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={() => handleFocus(index)}
            onPaste={handlePaste}
            className={cn(
              "w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border border-gray-200 bg-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#E03E3E] disabled:opacity-50",
              error && "border-red-500 focus:ring-red-500",
              activeInput === index && !error && "border-[#E03E3E] ring-1 ring-[#E03E3E]"
            )}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
