import React from 'react';
import { cn } from '../../lib/utils.js';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const textSizes = {
    sm: 'text-sm font-black',
    md: 'text-base font-black',
    lg: 'text-xl font-black'
  };

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl p-1.5 shadow-md shadow-brand-500/20 shrink-0',
          iconSizes[size]
        )}
      >
        <img
          src="/favicon.svg"
          alt="Egyptian Programming Academy"
          className="w-full h-full object-contain filter"
        />
      </div>

      {showText && !iconOnly && (
        <span
          className={cn(
            'tracking-tight text-slate-900 dark:text-slate-100 font-bold',
            forceShowTextOnMobile ? 'inline' : 'hidden sm:inline',
            textSizes[size]
          )}
        >
          {t('common.appName')}
        </span>
      )}
    </div>
  );
}
