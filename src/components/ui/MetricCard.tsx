import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  direction?: 'up' | 'down' | 'same';
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, delta, direction, icon, className = '' }: MetricCardProps) {
  const directionColor = direction === 'up' ? 'text-neon' : direction === 'down' ? 'text-hot' : 'text-text-dim';
  const DirIcon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;

  return (
    <div className={`glass rounded-xl p-4 ${className}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-text-dim uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-text-dim">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="font-display text-2xl font-bold text-text">{value}</span>
        {delta && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${directionColor} mb-1`}>
            <DirIcon className="h-3 w-3" />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
