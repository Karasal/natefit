'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text-muted">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10
            text-text text-sm appearance-none
            focus:outline-none focus:border-neon/50 focus:ring-1 focus:ring-neon/20
            transition-colors duration-150
            ${error ? 'border-danger/50' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
