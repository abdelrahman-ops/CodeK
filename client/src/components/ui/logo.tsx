import React from 'react';
import { cn } from '../../lib/utils.js';

export function CodeKMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full h-full', className)}
      aria-hidden="true"
    >
      {/* Code Bracket '<' in Brand Indigo */}
      <path
        d="M10 10L5 16L10 22"
        className="stroke-[#4f46e5] dark:stroke-[#818cf8]"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Letter K Spine in Brand Indigo */}
      <path
        d="M14 8.5V23.5"
        className="stroke-[#4f46e5] dark:stroke-[#818cf8]"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Letter K Upper Arm in Vibrant Orange */}
      <path
        d="M24 9L14.5 16"
        className="stroke-[#f97316] dark:stroke-[#fb923c]"
        strokeWidth="2.75"
        strokeLinecap="round"
      />

      {/* Letter K Lower Arm in Vibrant Orange */}
      <path
        d="M14.5 16L24 23"
        className="stroke-[#f97316] dark:stroke-[#fb923c]"
        strokeWidth="2.75"
        strokeLinecap="round"
      />

      {/* Central Node */}
      <circle
        cx="14.5"
        cy="16"
        r="1.5"
        className="fill-[#f59e0b] dark:fill-[#fbbf24]"
      />
    </svg>
  );
}

export function Logo({
  className,
  size = 'md',
  showText = true,
  iconOnly = false,
  forceShowTextOnMobile = false,
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
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-base font-black',
    md: 'text-lg font-black',
    lg: 'text-2xl font-black',
  };

  return (
    <div dir="ltr" className={cn('inline-flex items-center gap-2.5 select-none [direction:ltr]', className)}>
      {/* Brand Icon Mark with White Background */}
      <div
        className={cn(
          'relative flex items-center justify-center shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-1.5 shadow-sm shadow-slate-200/50 dark:shadow-none transition-transform duration-200 group-hover:scale-105',
          iconSizes[size]
        )}
      >
        <CodeKMark />
      </div>

      {/* Brand Text: CodeK (Clean, No dot, No subtitle) */}
      {showText && !iconOnly && (
        <span
          dir="ltr"
          className={cn(
            'tracking-tight font-brand font-black select-none inline-flex items-baseline [direction:ltr]',
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
