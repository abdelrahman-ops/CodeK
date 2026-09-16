import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  PlayCircle,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Video,
  FileText,
  ShieldCheck,
  Calendar,
  Bookmark
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Progress } from '../../components/ui/progress.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { localizeText, formatStatus, formatDuration } from '../../lib/i18n-helpers.js';
import { useToast } from '../../components/ui/toast.js';
import { TextbookProvenance } from '../../components/curriculum/index.js';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const toast = useToast();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const { data: course, isLoading } = useQuery({
    queryKey: ['studentCourseDetail', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.courses.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const { data: courseProgress } = useQuery({
    queryKey: ['studentCourseProgress', id],
    queryFn: async () => {
      if (!id) return null;
      return (await api.curriculum.getProgress(id)).data.data;
    },
    enabled: Boolean(id)
  });

  if (isLoading) return <CardSkeleton />;

  if (!course) {
    return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;
  }

  const sections = course.sections || [];
  const unsectionedLessons = (course.lessons || []).filter(
    (l) => !l.sectionId || !sections.some((s) => s.id === l.sectionId)
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === undefined ? false : !prev[sectionId]
    }));
  };

  const isSectionOpen = (sectionId: string) => expandedSections[sectionId] !== false;

  // Find first uncompleted accessible lesson or first lesson
  const allLessonsInOrder = [
    ...sections.flatMap((s) => s.lessons || []),
    ...unsectionedLessons
  ];
  const nextLesson =
    allLessonsInOrder.find((l) => !l.isLocked && l.progress?.status !== 'COMPLETED') ||
    allLessonsInOrder[0];

  const completedCount = courseProgress?.completedLessons ?? 0;
  const totalCount = courseProgress?.totalLessons ?? allLessonsInOrder.length;
  const progressPercent = courseProgress?.percentage ?? 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back to courses */}
      <button
        onClick={() => navigate('/student/courses')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{t('courses.backToCourses')}</span>
      </button>

      {/* Course Hero Banner */}
      <Card className="p-6 sm:p-8 bg-gradient-to-br from-brand-600 to-brand-800 text-white border-0 shadow-xl rounded-3xl overflow-hidden relative">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            {course.code && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/20 text-white backdrop-blur-sm border border-white/30">
                {course.code}
              </span>
            )}
            {course.authority === 'OFFICIAL' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400/25 text-amber-200 border border-amber-300/30 backdrop-blur-sm flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>منهج رسمي</span>
              </span>
            )}
            {course.academicYear && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-brand-100 backdrop-blur-sm">
                العام: {course.academicYear}
              </span>
            )}
            {course.term && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-brand-100 backdrop-blur-sm">
                {course.term === 'TERM_1' ? 'الترم الأول' : course.term === 'TERM_2' ? 'الترم الثاني' : course.term}
              </span>
            )}
            <span className="text-xs text-brand-100 font-medium">
              {sections.length} {t('curriculum.sections')} • {allLessonsInOrder.length} {t('curriculum.lessons')}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            {localizeText(course.title)}
          </h1>
          {course.description && (
            <p className="text-sm text-brand-100 max-w-3xl leading-relaxed">
              {localizeText(course.description)}
            </p>
          )}

          {/* Progress Meter */}
          <div className="pt-2 max-w-md space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-brand-100">
              <span>{t('courses.courseProgress')}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-brand-200">
              {completedCount} / {totalCount} {t('courses.completedLessons')}
            </div>
          </div>

          {/* Continue / Next Lesson button */}
          {nextLesson && (
            <div className="pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigate(`/student/courses/${course.id}/lessons/${nextLesson.id}`);
                }}
                className="gap-2 font-bold shadow-lg"
              >
                {nextLesson.isLocked ? (
                  <>
                    <Lock className="w-4 h-4 text-slate-700" />
                    <span>{isRtl ? 'فتح الدرس والاشتراك' : 'Unlock Lesson'}</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 text-brand-600" />
                    <span>
                      {progressPercent > 0 ? t('courses.continueWatching') : t('courses.startLearning')}
                    </span>
                  </>
                )}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Factual Ministry Curriculum Provenance Banner */}
      <TextbookProvenance
        authority={course.authority}
        academicYear={course.academicYear}
        term={course.term}
        track={course.track}
      />

      {/* Syllabus / Sections List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('courses.syllabus')}</span>
          </h2>
        </div>

        {sections.map((section, sIdx) => {
          const sLessons = section.lessons || [];
          const isOpen = isSectionOpen(section.id);
          const sCompleted = sLessons.filter((l) => l.progress?.status === 'COMPLETED').length;

          return (
            <div
              key={section.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
            >
              {/* Section Header Accordion */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-start bg-slate-50/70 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {sIdx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {localizeText(section.title)}
                      </h3>
                      {section.code && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {section.code}
                        </span>
                      )}
                    </div>
                    {section.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{localizeText(section.description)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-slate-400">
                    {sCompleted}/{sLessons.length} {t('courses.completedLessons')}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* Lessons List in Section */}
              {isOpen && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sLessons.map((lesson, lIdx) => {
                    const isCompleted = lesson.progress?.status === 'COMPLETED';
                    const isInProgress = lesson.progress?.status === 'IN_PROGRESS';
                    const isLocked = lesson.isLocked;
                    const isFree = lesson.isFree;

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => {
                          navigate(`/student/courses/${course.id}/lessons/${lesson.id}`);
                        }}
                        className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition cursor-pointer ${
                          isLocked
                            ? 'opacity-80 bg-slate-50/40 dark:bg-slate-950/30 hover:bg-brand-50/20'
                            : isInProgress
                            ? 'bg-brand-50/40 dark:bg-brand-950/20 hover:bg-brand-50/70'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* State Icon */}
                          <div className="shrink-0">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : isLocked ? (
                              <Lock className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <PlayCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-slate-400">
                                {sIdx + 1}.{lIdx + 1}
                              </span>
                              {lesson.code && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {lesson.code}
                                </span>
                              )}
                              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {localizeText(lesson.title)}
                              </h4>
                              {lesson.pageRange && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <Bookmark className="w-2.5 h-2.5" />
                                  <span>ص {lesson.pageRange.replace(/^ص\s*/, '')}</span>
                                </span>
                              )}
                              {isFree ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <Sparkles className="w-3 h-3" />
                                  {isRtl ? 'معاينة مجانية' : 'Free Preview'}
                                </span>
                              ) : isLocked ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                                  <Lock className="w-2.5 h-2.5" />
                                  {isRtl ? 'محتوى باشتراك' : 'Subscription'}
                                </span>
                              ) : null}
                              {lesson.videoUrl && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                  <Video className="w-3 h-3" />
                                </span>
                              )}
                            </div>

                            {isLocked && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {isRtl ? 'متاح بالكامل ضمن اشتراك CodeK (250 ج.م / 30 يوماً)' : 'Included with CodeK Subscription (250 EGP / 30 Days)'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(lesson.estimatedDurationMinutes)}
                          </span>

                          <Button
                            size="sm"
                            variant={isLocked ? 'outline' : isCompleted ? 'ghost' : 'primary'}
                            className="text-xs"
                          >
                            {isLocked ? (
                              <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold">
                                <Lock className="w-3 h-3" />
                                <span>{isRtl ? 'اشتراك لفتح الدرس' : 'Unlock'}</span>
                              </span>
                            ) : isCompleted ? (
                              <span>{t('courses.reviewLesson')}</span>
                            ) : isFree ? (
                              <span className="flex items-center gap-1 font-bold">
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                <span>{isRtl ? 'معاينة مجانية' : 'Preview'}</span>
                              </span>
                            ) : (
                              <span>{t('lessons.openLesson')}</span>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Unsectioned Lessons */}
        {unsectionedLessons.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <h3 className="font-bold text-sm text-slate-600 dark:text-slate-400">{t('curriculum.lessons')}</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {unsectionedLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  onClick={() => {
                    if (lesson.isLocked) {
                      toast.error(lesson.lockMessage || t('lessons.lockedExplanation'));
                    } else {
                      navigate(`/student/courses/${course.id}/lessons/${lesson.id}`);
                    }
                  }}
                  className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2">
                    {lesson.isLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <PlayCircle className="w-4 h-4 text-brand-600" />}
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{localizeText(lesson.title)}</span>
                  </div>
                  <Button size="sm" variant={lesson.isLocked ? 'outline' : 'primary'}>
                    {lesson.isLocked ? t('common.locked') : t('lessons.openLesson')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
