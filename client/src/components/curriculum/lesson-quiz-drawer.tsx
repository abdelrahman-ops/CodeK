import React, { useState, useEffect } from 'react';
import { X, Award, HelpCircle, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Exam, ExamQuestion } from '../../types/api';
import { api } from '../../lib/api/client.js';
import { cn } from '../../lib/utils.js';
import { formatMathText } from '../../lib/i18n-helpers.js';

interface LessonQuizDrawerProps {
  quiz?: Exam | null;
  isOpen: boolean;
  onClose: () => void;
  onQuizCompleted?: (xpEarned: number, score: number, percentage: number) => void;
}

export const LessonQuizDrawer: React.FC<LessonQuizDrawerProps> = ({
  quiz,
  isOpen,
  onClose,
  onQuizCompleted
}) => {
  if (!isOpen || !quiz) return null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptResult, setAttemptResult] = useState<any>(quiz.myAttempt || null);

  useEffect(() => {
    let isMounted = true;
    const fetchQuizDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.exams.getById(quiz.id);
        if (isMounted) {
          const examData = res.data.data;
          setQuestions(examData.questions || []);
          if (examData.myAttempt) {
            setAttemptResult(examData.myAttempt);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.error?.message || 'تعذر تحميل أسئلة الاختبار التقييمي');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQuizDetails();
    return () => {
      isMounted = false;
    };
  }, [quiz.id]);

  const parseOptions = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  };

  const handleSelectOption = (questionId: string, option: string) => {
    if (attemptResult) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attemptResult || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.exams.submit(quiz.id, { answers });
      const data = res.data.data;
      const attempt = data.attempt || data;
      setAttemptResult(attempt);
      if (onQuizCompleted) {
        onQuizCompleted(
          data.xpEarned || attempt.xpEarned || 30,
          data.score || attempt.score || 0,
          data.percentage || attempt.percentage || 0
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'تعذر تسليم الاختبار';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
      {/* 100% Solid Backdrop with Blur — obscuring the lesson page beneath */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Focused, 100% Solid Opaque Modal Card */}
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg truncate">
                  {quiz.title}
                </h3>
                {quiz.code && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                    {quiz.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>اختبار تقييم ختامي لمفاهيم الدرس</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  (+{quiz.xpReward || 30} XP)
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="إغلاق الاختبار"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/60 dark:bg-slate-950/40">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold">جاري تحميل أسئلة الاختبار...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div>
                <span className="font-bold">تنبيه:</span> {error}
              </div>
            </div>
          ) : attemptResult ? (
            /* Completed Screen */
            <div className="p-6 sm:p-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-white to-white dark:via-slate-900 dark:to-slate-900 text-center space-y-5 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  تم إتمام الاختبار التقييمي بنجاح!
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  لقد تم رصد وتقييم إجاباتك بنجاح وحساب نقاط الخبرة لحسابك.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-2">
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-400 block font-medium">الدرجة</span>
                  <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                    {attemptResult.score ?? 0} / {quiz.totalMarks ?? 100}
                  </span>
                </div>
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-400 block font-medium">النسبة</span>
                  <span className="text-lg sm:text-xl font-bold text-brand-600 dark:text-brand-400 mt-1 block">
                    {attemptResult.percentage ?? 0}%
                  </span>
                </div>
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-400 block font-medium">النقاط</span>
                  <span className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 mt-1">
                    <Sparkles className="w-4 h-4 fill-amber-500" />
                    +{attemptResult.xpEarned ?? 30}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-sm cursor-pointer"
                >
                  العودة للدرس ومتابعة الإنجاز
                </button>
              </div>
            </div>
          ) : (
            /* Questions Form */
            <form id="lesson-quiz-form" onSubmit={handleSubmit} className="space-y-5">
              {questions.map((q, idx) => {
                const options = parseOptions(q.options);

                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed flex-1">
                        <span className="text-brand-600 dark:text-brand-400 font-bold ml-1.5 font-mono">
                          {idx + 1}.
                        </span>
                        {formatMathText(q.questionText)}
                      </h4>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg shrink-0 border border-slate-200 dark:border-slate-700 font-mono">
                        {q.marks} {q.marks === 1 ? 'درجة' : 'درجات'}
                      </span>
                    </div>

                    {/* Options List or Short Answer Input */}
                    {options.length > 0 ? (
                      <div className="space-y-2.5 pt-1">
                        {options.map((option, optIdx) => {
                          const isSelected = answers[q.id] === option;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(q.id, option)}
                              className={cn(
                                'w-full p-3.5 rounded-xl border text-xs sm:text-sm text-right transition-all flex items-center justify-between gap-3 cursor-pointer select-none',
                                isSelected
                                  ? 'border-brand-500 bg-brand-50/90 dark:bg-brand-950/70 text-brand-900 dark:text-brand-100 font-bold shadow-xs'
                                  : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              )}
                            >
                              <span className="leading-relaxed flex-1">{formatMathText(option)}</span>
                              <span
                                className={cn(
                                  'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                                  isSelected
                                    ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                )}
                              >
                                {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="pt-1">
                        <textarea
                          rows={3}
                          className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none transition resize-none"
                          placeholder="اكتب إجابتك هنا بالتفصيل..."
                          value={answers[q.id] || ''}
                          onChange={(e) => handleSelectOption(q.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </form>
          )}
        </div>

        {/* Sticky Submit Footer (Only shown when taking test) */}
        {!loading && !attemptResult && !error && (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                تمت الإجابة:
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {answeredCount} / {questions.length}
              </span>
            </div>

            <button
              type="submit"
              form="lesson-quiz-form"
              disabled={!allAnswered || submitting}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>تسليم الاختبار ورصد النتيجة</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
