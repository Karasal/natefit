import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'neon' | 'electric' | 'hot' | 'danger';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-text-muted',
  neon: 'bg-neon/10 text-neon',
  electric: 'bg-electric/10 text-electric',
  hot: 'bg-hot/10 text-hot',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
      ${variantStyles[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
}
