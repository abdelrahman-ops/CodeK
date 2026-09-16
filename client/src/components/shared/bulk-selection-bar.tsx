import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';

export interface BulkActionItem {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'danger' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'success';
  disabled?: boolean;
  className?: string;
}

export interface BulkSelectionBarProps {
  totalItems: number;
  selectedCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected?: () => void;
  actions?: BulkActionItem[];
  children?: React.ReactNode;
  isLoading?: boolean;
  itemTypeLabel?: { singular: string; plural: string };
}

export function BulkSelectionBar({
  totalItems,
  selectedCount,
  isAllSelected,
  isIndeterminate,
  onToggleSelectAll,
  onDeselectAll,
  onDeleteSelected,
  actions = [],
  children,
  isLoading = false,
  itemTypeLabel
}: BulkSelectionBarProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs transition-all">
      {/* Left side: Select All Checkbox & Label */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-bold text-slate-700 dark:text-slate-200">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={isAllSelected}
            onChange={onToggleSelectAll}
            disabled={isLoading}
            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer accent-brand-600"
          />
          <span>{isArabic ? 'تحديد الكل' : 'Select All'}</span>
        </label>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              {selectedCount} {isArabic ? 'محدد' : 'selected'}
            </Badge>

            <button
              type="button"
              onClick={onDeselectAll}
              disabled={isLoading}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 font-medium underline cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>{isArabic ? 'إلغاء التحديد' : 'Deselect'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Right side: Actions Toolbar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((act, idx) => (
            <Button
              key={act.id || idx}
              size="sm"
              variant={act.variant === 'danger' ? 'danger' : act.variant === 'secondary' ? 'secondary' : act.variant === 'outline' ? 'outline' : 'primary'}
              onClick={act.onClick}
              disabled={isLoading || act.disabled}
              className={`text-xs gap-1.5 ${act.className || ''}`}
            >
              {act.icon}
              <span>{act.label}</span>
            </Button>
          ))}

          {children}

          {onDeleteSelected && (
            <Button
              size="sm"
              onClick={onDeleteSelected}
              disabled={isLoading}
              isLoading={isLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500 text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isArabic
                  ? `حذف المحدد (${selectedCount})`
                  : `Delete Selected (${selectedCount})`}
              </span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

