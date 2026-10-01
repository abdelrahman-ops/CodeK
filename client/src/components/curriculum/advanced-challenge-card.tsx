import React, { useState } from 'react';
import { Sparkles, Trophy, ChevronDown, ChevronUp, FileCode, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Task } from '../../types/api';

interface AdvancedChallengeCardProps {
  challenge?: Task | null;
  onSubmitClick?: (challenge: Task) => void;
}

export const AdvancedChallengeCard: React.FC<AdvancedChallengeCardProps> = ({
  challenge,
  onSubmitClick
}) => {
  if (!challenge) return null;

  const [showInstructions, setShowInstructions] = useState(false);

  const submission = challenge.mySubmission || (challenge as any).submissions?.[0] || null;
  const status = submission?.status;

  const getStatusBadge = () => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم اجتياز التحدي
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            قيد المراجعة
          </span>
        );
      case 'NEEDS_REVISION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            يتطلب تعديلاً
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            تحدٍ اختياري إضافي
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-card to-background p-4 md:p-6 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm md:text-base flex items-center gap-1.5">
                <span>التحدي البرمجي المتقدم</span>
                <Sparkles className="w-4 h-4 text-purple-500" />
              </h3>
              {challenge.code && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                  {challenge.code}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              تحدٍ هندسي للمتفوقين لتعميق الفهم وبناء محفظة برمجية احترافية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <Trophy className="w-3.5 h-3.5" />
            +{challenge.xpReward} XP
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-3">
        <div>
          <h4 className="text-base font-bold text-foreground">
            {challenge.title}
          </h4>
          {challenge.description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {challenge.description}
            </p>
          )}
        </div>

        {/* Instructions Collapsible */}
        {challenge.instructions && (
          <div className="rounded-xl border border-border bg-background/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-purple-500" />
                شروط ومتطلبات التحدي
              </span>
              {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showInstructions && (
              <div className="p-3.5 text-xs md:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed border-t border-border/60">
                {challenge.instructions}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        {onSubmitClick && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onSubmitClick(challenge)}
              className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
            >
              {status ? 'مراجعة تسليم التحدي' : 'خوض التحدي وتسليم الحل'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
