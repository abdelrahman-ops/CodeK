import React from 'react';
import { cn } from '../../lib/utils.js';

export function Logo({
  className,
  size = 'md',
  showText = true,
  iconOnly = false,
  forceShowTextOnMobile = false
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  iconOnly?: boolean;
  forceShowTextOnMobile?: boolean;
}) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const textSizes = {
    sm: 'text-base font-black',
    md: 'text-lg font-black',
    lg: 'text-2xl font-black'
  };

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl p-1.5 shadow-md shadow-brand-500/20 shrink-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80',
          iconSizes[size]
        )}
      >
        <img
          src="/favicon.svg"
          alt="CodeK"
          className="w-full h-full object-contain filter drop-shadow-sm"
        />
      </div>

      {showText && !iconOnly && (
        <span
          className={cn(
            'tracking-tight font-brand font-black select-none inline-flex items-baseline',
            forceShowTextOnMobile ? 'inline-flex' : 'hidden sm:inline-flex',
            textSizes[size]
          )}
        >
          <span className="text-[#4f46e5] dark:text-[#818cf8]">Code</span>
          <span className="text-[#f97316] dark:text-[#fb923c]">K</span>
        </span>
      )}
    </div>
  );
}
