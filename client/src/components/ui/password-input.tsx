import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import { InputProps } from './input.js';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
  showToggleLabel?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, helperText, leftIcon, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const { t } = useTranslation();
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const toggleText = showPassword
      ? t('auth.hidePassword', 'Hide password')
      : t('auth.showPassword', 'Show password');

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute start-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            className={cn(
              'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition duration-150 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50',
              leftIcon && 'ps-10',
              'pe-11',
              error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
              className
            )}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={toggleText}
            title={toggleText}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute end-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {error ? (
          <span className="text-xs font-medium text-red-500">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
