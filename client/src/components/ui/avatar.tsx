import React from 'react';
import { cn } from '../../lib/utils.js';

export function Avatar({
  src,
  name,
  className,
  size = 'md'
}: {
  src?: string | null;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [hasError, setHasError] = React.useState(false);

  const getInitials = (str: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const getColor = (str: string) => {
    const colors = [
      'bg-brand-500 text-white',
      'bg-emerald-500 text-white',
      'bg-amber-500 text-white',
      'bg-rose-500 text-white',
      'bg-purple-500 text-white',
      'bg-cyan-500 text-white'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center font-bold rounded-2xl overflow-hidden shrink-0 select-none shadow-sm',
        sizes[size],
        getColor(name),
        className
      )}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={name}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
