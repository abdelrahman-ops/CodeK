import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Lock,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { MarkdownViewer } from '../../components/shared/markdown-viewer.js';
import { Lesson } from '../../types/api.js';
import { localizeText, formatStatus, formatDuration } from '../../lib/i18n-helpers.js';

export function CurriculumPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: curricula, isLoading } = useQuery({
    queryKey: ['curriculum'],
    queryFn: async () => (await api.curriculum.list()).data.data
  });

  const { data: lessons } = useQuery({
    queryKey: ['studentLessons'],
    queryFn: async () => (await api.lessons.list()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t('curriculum.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('curriculum.subtitle')}
        </p>
      </div>

      {curricula?.map((curriculum) => {
        const curriculumLessons = lessons?.filter((l) => l.curriculumId === curriculum.id) || [];

        return (
          <div key={curriculum.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {localizeText(curriculum.title)}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{localizeText(curriculum.description)}</p>
              </div>
              <Badge variant="primary">{formatStatus(curriculum.type)}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {curriculumLessons.map((lesson) => (
                <Card
                  key={lesson.id}
                  className={`p-5 flex flex-col justify-between gap-4 transition hover:border-brand-300 dark:hover:border-brand-700 ${lesson.isLocked ? 'opacity-75 bg-slate-50/50 dark:bg-slate-900/50' : ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={lesson.isLocked ? 'secondary' : 'success'} size="sm">
                        {lesson.isLocked ? (
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" /> {t('common.locked')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t('common.unlocked')}
                          </span>
                        )}
                      </Badge>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(lesson.estimatedDurationMinutes)}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      {localizeText(lesson.title)}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{localizeText(lesson.description)}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <Badge variant="outline" size="sm">
                      {formatStatus(lesson.difficulty)}
                    </Badge>
                    <Button
                      size="sm"
                      variant={lesson.isLocked ? 'outline' : 'primary'}
                      onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                    >
                      <span>{lesson.isLocked ? t('common.locked') : t('lessons.openLesson')}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LessonViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: lesson, isLoading } = useQuery<Lesson>({
    queryKey: ['lesson', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.lessons.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  if (isLoading) return <CardSkeleton />;

  if (!lesson) {
    return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/student/curriculum')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{t('curriculum.backToCurriculum')}</span>
      </button>

      {/* Lesson Header */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <Badge variant={lesson.isLocked ? 'secondary' : 'success'}>
            {lesson.isLocked ? t('common.locked') : t('common.unlocked')}
          </Badge>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(lesson.estimatedDurationMinutes)}
            </span>
            <span>•</span>
            <span className="font-semibold uppercase">{formatStatus(lesson.difficulty)}</span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {localizeText(lesson.title)}
        </h1>
        {lesson.description && (
          <p className="text-sm text-slate-500 mt-1">{localizeText(lesson.description)}</p>
        )}

        {/* External Resource / Canva Link */}
        {lesson.externalResourceUrl && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-brand-50/50 to-brand-100/50 dark:from-brand-950/20 dark:to-brand-900/20 p-3.5 rounded-2xl border border-brand-200/60 dark:border-brand-800/40">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-brand-900 dark:text-brand-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>{localizeText(lesson.externalResourceTitle) || t('lessons.externalPresentation')}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('lessons.openExternalHint')}
              </p>
            </div>
            <a
              href={lesson.externalResourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition shrink-0"
            >
              <span>{t('lessons.openResource')}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </a>
          </div>
        )}
      </Card>

      {/* Locked Screen vs Unlocked Markdown */}
      {lesson.isLocked ? (
        <Card className="p-8 text-center border-amber-300 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t('lessons.lessonLocked')}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {t('lessons.unlockInstruction')}
            </p>
          </div>
          <Button onClick={() => navigate('/student/today')}>
            {t('nav.today')}
          </Button>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          {lesson.content ? (
            <MarkdownViewer content={lesson.content} />
          ) : (
            <div className="text-center py-8 text-slate-400">
              {t('common.noData')}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
