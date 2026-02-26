'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, suffix, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10
              text-text placeholder:text-text-dim text-sm
              focus:outline-none focus:border-neon/50 focus:ring-1 focus:ring-neon/20
              transition-colors duration-150
              ${suffix ? 'pr-12' : ''}
              ${error ? 'border-danger/50 focus:border-danger focus:ring-danger/20' : ''}
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-dim font-mono">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
