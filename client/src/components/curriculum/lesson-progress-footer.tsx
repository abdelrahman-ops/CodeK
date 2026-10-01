import React from 'react';
import { CheckCircle, ArrowLeft, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LessonProgressFooterProps {
  isCompleted?: boolean;
  progressPercentage?: number;
  isLocked?: boolean;
  nextLesson?: { id: string; title: string; order: number } | null;
  curriculumId?: string;
  onMarkComplete: () => Promise<void>;
  isCompleting: boolean;
  onOpenQuiz?: () => void;
  hasQuiz?: boolean;
  quizCompleted?: boolean;
}

export const LessonProgressFooter: React.FC<LessonProgressFooterProps> = ({
  isCompleted = false,
  progressPercentage = 0,
  isLocked = false,
  nextLesson,
  curriculumId,
  onMarkComplete,
  isCompleting,
  onOpenQuiz,
  hasQuiz = false,
  quizCompleted = false
}) => {
  if (isLocked) return null;

  return (
    <div className="sticky bottom-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/80 px-4 py-3 md:px-8 mt-12 transition-all">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Progress Info */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isCompleted ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">
                {isCompleted ? 'الدرس مكتمل بنجاح' : 'متابعة إنجاز الدرس'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                نسبة التقدم: {isCompleted ? '100%' : `${progressPercentage}%`}
              </span>
            </div>
          </div>

          {/* Quiz Shortcut if present */}
          {hasQuiz && onOpenQuiz && (
            <button
              type="button"
              onClick={onOpenQuiz}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                quizCompleted
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{quizCompleted ? 'نتيجة الاختبار' : 'بدء اختبار الدرس'}</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {!isCompleted && (
            <button
              type="button"
              onClick={onMarkComplete}
              disabled={isCompleting}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              {isCompleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>إتمام الدرس</span>
            </button>
          )}

          {nextLesson && curriculumId && (
            <Link
              to={`/student/courses/${curriculumId}/lessons/${nextLesson.id}`}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>الدرس التالي</span>
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
