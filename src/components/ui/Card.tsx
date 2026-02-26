import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, padding = true, hover = false, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        glass rounded-xl
        ${padding ? 'p-5' : ''}
        ${hover ? 'glass-hover cursor-pointer transition-all duration-200' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`font-display text-lg font-semibold text-text ${className}`}>
      {children}
    </h3>
  );
}
