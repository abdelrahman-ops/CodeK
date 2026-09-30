import React from 'react';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  isDestructive = true,
  isLoading = false
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText || t('common.cancel')}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            className={
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500'
                : undefined
            }
          >
            {confirmText || (isDestructive ? t('common.delete') : t('common.confirm'))}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
