import React from 'react';
import { cn } from '../../lib/utils.js';

export function Avatar({
  src,
  name,
  className,
  size = 'md'
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [hasError, setHasError] = React.useState(false);
  const safeName = (name && name.trim() && name !== 'undefined undefined') ? name.trim() : 'User';

  const getInitials = (str: string) => {
    if (!str || str === 'User') return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
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
    if (!str) return colors[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center font-bold rounded-2xl overflow-hidden shrink-0 select-none shadow-sm',
        sizes[size],
        getColor(safeName),
        className
      )}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={safeName}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{getInitials(safeName)}</span>
      )}
    </div>
  );
}
