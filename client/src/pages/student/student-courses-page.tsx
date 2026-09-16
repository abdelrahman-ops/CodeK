import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  PlayCircle,
  Clock,
  Layers,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Trophy
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Progress } from '../../components/ui/progress.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { localizeText, formatStatus } from '../../lib/i18n-helpers.js';

export function StudentCoursesPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['studentCoursesSummary'],
    queryFn: async () => (await api.courses.getStudentSummary()).data.data
  });

  const { data: subData } = useQuery({
    queryKey: ['mySubscription'],
    queryFn: async () => (await api.billing.getMySubscription()).data.data
  });

  const isSubscribed = subData?.isActive;

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('courses.title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('courses.subtitle')}
          </p>
        </div>

        {!isSubscribed && (
          <Button
            onClick={() => navigate('/student/subscription')}
            className="gap-2 text-xs font-black bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{isRtl ? 'فتح كافة المسارات (250 ج.م)' : 'Unlock All Courses (250 EGP)'}</span>
          </Button>
        )}
      </div>

      {/* Commercial Conversion Banner if not subscribed */}
      {!isSubscribed && (
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-brand-600/10 via-brand-500/5 to-transparent border border-brand-200 dark:border-brand-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isRtl ? 'جميع المسارات متاحة باشتراك رمزي موحد: 250 ج.م / 30 يوماً' : 'All courses included with CodeK Subscription: 250 EGP / 30 Days'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl ? 'تعلّم البرمجة بخطوات عملية مع فيديوهات عالية الجودة ومشاريع حقيقية وتصحيح تفاعلي.' : 'Learn programming with hands-on practice, high-definition videos, and real projects.'}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('/student/subscription')}
            className="gap-1.5 text-xs font-bold shrink-0"
          >
            <span>{isRtl ? 'اشترك الآن' : 'Subscribe Now'}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Button>
        </Card>
      )}

      {/* Courses List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses?.map((course) => {
          const isCompleted = course.percentage === 100;
          const isInProgress = course.percentage > 0 && !isCompleted;

          return (
            <Card
              key={course.id}
              className="p-6 sm:p-7 flex flex-col justify-between gap-6 border-slate-200/80 dark:border-slate-800/80 hover:border-brand-300 dark:hover:border-brand-700 transition shadow-sm rounded-3xl"
            >
              <div className="space-y-4">
                {/* Track Badge & Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="primary" size="sm">
                    {formatStatus(course.type)}
                  </Badge>

                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('courses.completed')}
                    </span>
                  ) : isInProgress ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 rounded-full border border-brand-200 dark:border-brand-800">
                      <PlayCircle className="w-3.5 h-3.5" />
                      {t('courses.inProgress')}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">
                      {t('courses.notStarted')}
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 hover:text-brand-600 transition cursor-pointer"
                    onClick={() => navigate(`/student/courses/${course.id}`)}
                  >
                    {localizeText(course.title)}
                  </h2>
                  {course.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {localizeText(course.description)}
                    </p>
                  )}
                </div>

                {/* Stats Meta */}
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-500" />
                    {course.sectionsCount} {t('curriculum.sections')}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-brand-500" />
                    {course.totalLessons} {t('curriculum.lessons')}
                  </span>
                </div>

                {/* Progress Bar & Percentage */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{t('courses.courseProgress')}</span>
                    <span className="text-brand-600 dark:text-brand-400">{course.percentage}%</span>
                  </div>
                  <Progress value={course.percentage} className="h-2.5 rounded-full" />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{course.completedLessons} / {course.totalLessons} {t('courses.completedLessons')}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/student/courses/${course.id}`)}
                >
                  <span>{t('courses.viewSyllabus')}</span>
                </Button>

                {course.continueLesson ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/student/courses/${course.id}/lessons/${course.continueLesson.lessonId}`)
                    }
                    className="gap-2"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{isInProgress ? t('courses.continueWatching') : t('courses.startLearning')}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => navigate(`/student/courses/${course.id}`)}
                    className="gap-2"
                  >
                    <span>{t('courses.viewDetails')}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
