import React from 'react';
import { cn } from '../../lib/utils.js';
import { Card } from './card.js';

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { label: string; positive?: boolean };
  className?: string;
}) {
  return (
    <Card className={cn('p-5 flex items-center justify-between', className)}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </div>
        {subtitle && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
        )}
        {trend && (
          <span
            className={cn(
              'text-xs font-semibold mt-1 inline-flex items-center gap-1',
              trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}
          >
            {trend.label}
          </span>
        )}
      </div>
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 shadow-inner">
          {icon}
        </div>
      )}
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 mb-6 border-b border-slate-200/60 dark:border-slate-800/60',
        className
      )}
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
