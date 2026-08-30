import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  Clock,
  Award,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { ExamTimer } from '../../components/shared/exam-timer.js';
import { CelebrationModal } from '../../components/shared/celebration-modal.js';
import { useToast } from '../../components/ui/toast.js';
import { Exam } from '../../types/api.js';
import { localizeText, formatStatus, formatDuration, formatMarks, formatXp } from '../../lib/i18n-helpers.js';

export function ExamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: exams, isLoading } = useQuery<Exam[]>({
    queryKey: ['studentExams'],
    queryFn: async () => (await api.exams.list()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          {t('exams.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('exams.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exams?.map((exam) => {
          const attempt = exam.myAttempt;
          const isCompleted = Boolean(attempt);

          return (
            <Card
              key={exam.id}
              className={`p-6 flex flex-col justify-between gap-4 transition hover:border-brand-300 dark:hover:border-brand-700 ${isCompleted ? 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/10' : ''}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={isCompleted ? 'success' : 'primary'} size="sm">
                    {isCompleted ? t('common.completed') : t('common.available')}
                  </Badge>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {formatXp(exam.xpReward)}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {localizeText(exam.title)}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2">{localizeText(exam.description)}</p>
              </div>

              {isCompleted && attempt && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-200">
                  <span>{t('exams.score')}: {attempt.score} / {exam.totalMarks} ({attempt.percentage}%)</span>
                  <span>+{attempt.xpEarned} XP</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(exam.durationMinutes)}
                  </span>
                  <span>•</span>
                  <span>{formatMarks(exam.totalMarks)}</span>
                </div>

                <Button size="sm" onClick={() => navigate(`/student/exams/${exam.id}`)}>
                  <span>{isCompleted ? t('common.viewScore') : t('exams.startExam')}</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ExamTakePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<{ isOpen: boolean; title: string; subtitle?: string; xp?: number } | null>(null);

  const { data: exam, isLoading, refetch } = useQuery<Exam>({
    queryKey: ['exam', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.exams.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const handleSubmit = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const res = await api.exams.submit(id, { answers });
      const result = res.data.data;
      toast.success(t('exams.submitExam') + ' - ' + t('common.success'));
      await refetch();
      setCelebration({
        isOpen: true,
        title: `${t('exams.examCompleted')}: ${result.percentage}%`,
        subtitle: `${t('exams.score')}: ${result.score} / ${result.totalMarks}`,
        xp: result.xpEarned
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <CardSkeleton />;

  if (!exam) return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;

  const attempt = exam.myAttempt;
  const questions = exam.questions || [];
  const currentQuestion = questions[currentQIndex];

  // If already submitted, show score results
  if (attempt) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/student/exams')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('exams.backToExams')}</span>
        </button>

        <Card className="p-8 text-center border-emerald-300 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {localizeText(exam.title)} - {t('common.completed')}
          </h2>

          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-4">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">{t('exams.score')}</span>
              <div className="text-xl font-black">{attempt.score} / {exam.totalMarks}</div>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">{t('dashboard.level')}</span>
              <div className="text-xl font-black text-emerald-600">{attempt.percentage}%</div>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">{t('dashboard.totalXp')}</span>
              <div className="text-xl font-black text-brand-600">+{attempt.xpEarned} XP</div>
            </div>
          </div>

          <Button onClick={() => navigate('/student/exams')}>{t('exams.backToExams')}</Button>
        </Card>
      </div>
    );
  }

  // Active Exam Taking Screen
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Exam Header + Countdown Timer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">{localizeText(exam.title)}</h2>
          <span className="text-xs text-slate-500">
            {t('exams.questionsCount')}: {currentQIndex + 1} / {questions.length}
          </span>
        </div>

        <ExamTimer durationMinutes={exam.durationMinutes} onTimeUp={handleSubmit} />
      </div>

      {/* Current Question Card */}
      {currentQuestion && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>{t('exams.questionsCount')} {currentQIndex + 1}</span>
            <span>{formatMarks(currentQuestion.marks)}</span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
            {localizeText(currentQuestion.questionText)}
          </h3>

          {/* MCQ Options */}
          {currentQuestion.questionType === 'MULTIPLE_CHOICE' && currentQuestion.options && (
            <div className="space-y-2.5">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = answers[currentQuestion.id] === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [currentQuestion.id]: opt })}
                    className={`w-full p-4 rounded-2xl border text-start text-sm font-semibold transition flex items-center gap-3 ${isSelected ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 text-brand-700 dark:text-brand-300 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  >
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-mono text-xs ${isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-400'}`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span>{localizeText(opt)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Short Answer Input */}
          {currentQuestion.questionType === 'SHORT_ANSWER' && (
            <input
              type="text"
              placeholder={t('common.typeAnswerHere')}
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((prev) => prev - 1)}
            >
              {t('common.previous')}
            </Button>

            {currentQIndex === questions.length - 1 ? (
              <Button size="sm" onClick={handleSubmit} isLoading={isSubmitting}>
                {t('exams.submitExam')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCurrentQIndex((prev) => prev + 1)}>
                {t('common.next')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {celebration && (
        <CelebrationModal
          isOpen={celebration.isOpen}
          onClose={() => setCelebration(null)}
          title={celebration.title}
          subtitle={celebration.subtitle}
          xpEarned={celebration.xp}
        />
      )}
    </div>
  );
}
