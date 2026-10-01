import React, { useEffect } from 'react';
import { Dialog } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import confetti from 'canvas-confetti';
import { Award, Star, Sparkles, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizeText } from '../../lib/i18n-helpers.js';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  iconType?: 'award' | 'star' | 'trophy' | 'sparkles';
  xpEarned?: number;
}

export function CelebrationModal({
  isOpen,
  onClose,
  title,
  subtitle,
  iconType = 'award',
  xpEarned
}: CelebrationModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  }, [isOpen]);

  const renderIcon = () => {
    switch (iconType) {
      case 'trophy':
        return <Trophy className="w-12 h-12 text-amber-500 animate-pulse" />;
      case 'star':
        return <Star className="w-12 h-12 text-brand-500 fill-brand-500 animate-pulse" />;
      case 'sparkles':
        return <Sparkles className="w-12 h-12 text-purple-500 animate-pulse" />;
      default:
        return <Award className="w-12 h-12 text-emerald-500 animate-pulse" />;
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex flex-col items-center text-center p-4 gap-4">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
          {renderIcon()}
        </div>

        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{localizeText(title)}</h3>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{localizeText(subtitle)}</p>
          )}
        </div>

        {xpEarned !== undefined && (
          <div className="px-4 py-2 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-semibold text-lg flex items-center gap-2">
            <Star className="w-5 h-5 fill-brand-500 text-brand-500" />
            <span>+{xpEarned} XP</span>
          </div>
        )}

        <Button onClick={onClose} className="w-full mt-2">
          {t('common.close')}
        </Button>
      </div>
    </Dialog>
  );
}
