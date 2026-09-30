import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SectionTagProps {
  text: string;
  icon?: LucideIcon;
  className?: string;
}

export const SectionTag: React.FC<SectionTagProps> = ({
  text,
  icon: Icon,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80 shadow-xs select-none ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
      <span>{text}</span>
    </div>
  );
};
