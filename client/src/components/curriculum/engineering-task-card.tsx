import React, { useState } from 'react';
import { Wrench, Award, ChevronDown, ChevronUp, FileCode, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Task } from '../../types/api';

interface EngineeringTaskCardProps {
  task?: Task | null;
  onSubmitClick?: (task: Task) => void;
}

export const EngineeringTaskCard: React.FC<EngineeringTaskCardProps> = ({
  task,
  onSubmitClick
}) => {
  if (!task) return null;

  const [showInstructions, setShowInstructions] = useState(true);

  const submission = task.mySubmission || (task as any).submissions?.[0] || null;
  const status = submission?.status;

  const getStatusBadge = () => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم الاعتماد والتقييم
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            لم يُسلّم بعد
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-background p-4 md:p-6 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm md:text-base">
                المهمة الهندسية التطبيقية
              </h3>
              {task.code && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                  {task.code}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              تطبيق عملي مباشر على مفاهيم الدرس الأساسية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Award className="w-3.5 h-3.5" />
            +{task.xpReward} XP
          </span>
        </div>
      </div>

      {/* Task Body */}
      <div className="space-y-3">
        <div>
          <h4 className="text-base font-bold text-foreground">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Instructions Collapsible */}
        {task.instructions && (
          <div className="rounded-xl border border-border bg-background/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-blue-500" />
                متطلبات وتعليمات التنفيذ
              </span>
              {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showInstructions && (
              <div className="p-3.5 text-xs md:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed border-t border-border/60">
                {task.instructions}
              </div>
            )}
          </div>
        )}

        {/* Feedback if any */}
        {submission?.feedback && (
          <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
            <span className="font-semibold text-foreground">ملاحظات المعلم:</span>
            <p className="text-muted-foreground">{submission.feedback}</p>
          </div>
        )}

        {/* Action Button */}
        {onSubmitClick && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onSubmitClick(task)}
              className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              {status ? 'تحديث أو مراجعة التسليم' : 'تسليم المهمة الآن'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
