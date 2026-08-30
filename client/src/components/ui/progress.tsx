import React from 'react';
import { cn } from '../../lib/utils.js';

export function Progress({
  value = 0,
  max = 100,
  className,
  color = 'brand',
  showLabel = false
}: {
  value?: number;
  max?: number;
  className?: string;
  color?: 'brand' | 'success' | 'warning' | 'purple' | 'accent';
  showLabel?: boolean;
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const colors = {
    brand: 'bg-brand-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    purple: 'bg-purple-500',
    accent: 'bg-accent-500'
  };

  return (
    <div className="w-full flex flex-col gap-1">
      {showLabel && (
        <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
          <span>{percentage}%</span>
          <span>
            {value} / {max}
          </span>
        </div>
      )}
      <div
        className={cn(
          'w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden',
          className
        )}
      >
        <div
          className={cn('h-full transition-all duration-500 rounded-full', colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
