import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Video,
  List,
  ExternalLink,
  CheckSquare,
  X,
  PlayCircle,
  Zap,
  Trophy,
  HelpCircle,
  Check,
  CreditCard,
  Shield
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { MarkdownViewer } from '../../components/shared/markdown-viewer.js';
import { VideoPlayer } from '../../components/shared/video-player.js';
import { useToast } from '../../components/ui/toast.js';
import { useLearningStore } from '../../store/learning-store.js';
import { localizeText, formatStatus, formatDuration } from '../../lib/i18n-helpers.js';
import { Lesson, Curriculum } from '../../types/api.js';
import {
  LessonHeader,
  TextbookProvenance,
  VideoBlueprintCard,
  ConceptCardsDeck,
  EngineeringTaskCard,
  AdvancedChallengeCard,
  LessonQuizDrawer,
  LessonProgressFooter
} from '../../components/curriculum/index.js';

export function LessonPlayerPage() {
  const { id, courseId } = useParams<{ id: string; courseId?: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const isRtl = i18n.language === 'ar';
  const { isMobileSyllabusOpen, toggleMobileSyllabus, setLastActiveLesson } = useLearningStore();
  const [isQuizDrawerOpen, setIsQuizDrawerOpen] = useState(false);

  const { data: lesson, isLoading: isLessonLoading } = useQuery<Lesson>({
    queryKey: ['studentLesson', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.lessons.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const activeCourseId = courseId || lesson?.curriculumId;

  const { data: playbackData } = useQuery({
    queryKey: ['lessonPlayback', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const res = await api.lessons.getPlayback(id);
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(id && lesson && !lesson.isLocked)
  });

  const { data: course } = useQuery<Curriculum>({
    queryKey: ['studentCourseDetail', activeCourseId],
    queryFn: async () => {
      if (!activeCourseId) throw new Error('No course id');
      return (await api.courses.getById(activeCourseId)).data.data;
    },
    enabled: Boolean(activeCourseId)
  });


  // Track active lesson in store
  useEffect(() => {
    if (lesson && activeCourseId) {
      setLastActiveLesson({
        courseId: activeCourseId,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseTitle: course?.title,
        lastWatchedPosition: lesson.progress?.lastWatchedPosition,
        progressPercentage: lesson.progress?.progressPercentage
      });
    }
  }, [lesson, activeCourseId, course?.title, setLastActiveLesson]);

  // Flatten course lessons in logical sequence
  const orderedLessons = useMemo(() => {
    if (!course) return [];
    const fromSections = (course.sections || []).flatMap((s) => s.lessons || []);
    const unsectioned = (course.lessons || []).filter(
      (l) => !l.sectionId || !(course.sections || []).some((s) => s.id === l.sectionId)
    );
    return [...fromSections, ...unsectioned];
  }, [course]);

  // Current lesson index & previous/next
  const currentIndex = orderedLessons.findIndex((l) => l.id === id);
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null;

  // Toggle Lesson Completion Mutation
  const toggleCompleteMutation = useMutation({
    mutationFn: async (isCompleted: boolean) => {
      if (!id) return;
      return (
        await api.lessons.updateProgress(id, {
          completed: !isCompleted,
          status: !isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          progressPercentage: !isCompleted ? 100 : 50
        })
      ).data.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['studentLesson', id] });
      queryClient.invalidateQueries({ queryKey: ['studentCourseDetail', activeCourseId] });
      queryClient.invalidateQueries({ queryKey: ['studentCoursesSummary'] });
      if (res?.status === 'COMPLETED') {
        toast.success(t('lessons.markedCompleted'));
      }
    }
  });

  // Video progress heartbeat mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ position, percentage }: { position: number; percentage?: number }) => {
      if (!id) return;
      return (
        await api.lessons.updateProgress(id, {
          lastWatchedPosition: Math.floor(position),
          progressPercentage: percentage,
          status: 'IN_PROGRESS'
        })
      ).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentCoursesSummary'] });
    }
  });

  const handleVideoProgress = (position: number, percentage?: number) => {
    updateProgressMutation.mutate({ position, percentage });
  };

  const handleVideoEnded = () => {
    if (lesson?.progress?.status !== 'COMPLETED') {
      toggleCompleteMutation.mutate(false);
    }
  };

  if (isLessonLoading) return <CardSkeleton />;

  if (!lesson) {
    return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;
  }

  const isCompleted = lesson.progress?.status === 'COMPLETED';

  // ----------------------------------------------------
  // LOCKED SCREEN: COMMERCIAL CONVERSION PAYWALL
  // ----------------------------------------------------
  if (lesson.isLocked) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <button
          onClick={() => navigate(activeCourseId ? `/student/courses/${activeCourseId}` : '/student/courses')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('courses.backToCourse')}</span>
        </button>

        <Card className="p-6 sm:p-10 border-brand-200 dark:border-brand-900/60 bg-gradient-to-br from-white via-slate-50 to-brand-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/20 space-y-6 rounded-3xl shadow-lg">
          {/* Paywall Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-black bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-800">
                {isRtl ? 'محتوى حصري للمشتركين • 250 ج.م / 30 يوماً' : 'Subscription Required • 250 EGP / 30 Days'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {t('paywall.title', 'هذا الدرس متاح حصرياً لمشتركي CodeK')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                {t('paywall.subtitle', 'اشترك الآن مقابل 250 ج.م فقط لمدة 30 يوماً لفتح الوصول لجميع الدروس، الفيديوهات، التحديات والمشاريع التفاعلية.')}
              </p>
            </div>
          </div>

          {/* Value Proposition List */}
          <div className="bg-white/80 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('paywall.benefitsTitle', 'ماذا يشمل اشتراك 250 ج.م / 30 يوماً؟')}
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('paywall.benefit1', 'وصول كامل وغير محدود لجميع مسارات ودروس البرمجة')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('paywall.benefit2', 'مشاهدة الفيديوهات والشروحات التطبيقية عالية الدقة')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('paywall.benefit3', 'حل المهام والمشاريع التفاعلية والحصول على التقييم')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('paywall.benefit4', 'المشاركة في الاختبارات الدورية وتجميع نقاط XP وقوائم المتصدرين')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('paywall.benefit5', 'حفظ دائم ومستمر لتقدمك وإنجازاتك في حسابك حتى بعد انتهاء الفترة')}</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate('/student/subscription')}
              className="w-full sm:w-auto px-8 gap-2 text-sm font-black bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20"
            >
              <CreditCard className="w-4 h-4" />
              <span>{t('paywall.subscribeCta', 'اشترك الآن — 250 ج.م / 30 يوماً')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate(activeCourseId ? `/student/courses/${activeCourseId}` : '/student/courses')}
              className="w-full sm:w-auto text-sm font-bold"
            >
              <span>{t('courses.viewSyllabus', 'عرض المنهج')}</span>
            </Button>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            {t('paywall.alreadySubscribedHelp', 'إذا قمت بالدفع للتو، انتظر لحظات حتى تؤكد بوابة الدفع العملية تلقائياً.')}
          </p>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------
  // UNLOCKED LESSON PLAYER INTERFACE
  // ----------------------------------------------------
  const currentSection = course?.sections?.find((s) => s.id === lesson.sectionId);
  const activeQuiz = lesson.quiz || lesson.nextSteps?.quiz;
  const hasEngineeringTask = Boolean(lesson.engineeringTask);
  const hasAdvancedChallenge = Boolean(lesson.advancedChallenge);
  const hasLegacyTasks = !hasEngineeringTask && !hasAdvancedChallenge && Boolean(lesson.tasks && lesson.tasks.length > 0);

  return (
    <div className="space-y-6 pb-24 lg:pb-16">
      {/* Top Breadcrumb Bar & Syllabus Toggle for Mobile */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(activeCourseId ? `/student/courses/${activeCourseId}` : '/student/courses')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{course ? localizeText(course.title) : t('courses.title')}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Mobile Syllabus Toggle Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleMobileSyllabus(true)}
            className="lg:hidden gap-1.5 text-xs font-bold"
          >
            <List className="w-4 h-4" />
            <span>{t('courses.syllabus')}</span>
          </Button>

          {/* Direct Quiz Trigger if present */}
          {activeQuiz && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsQuizDrawerOpen(true)}
              className="gap-1.5 text-xs font-bold border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>{activeQuiz.myAttempt ? t('exams.reviewAttempt', 'مراجعة الاختبار') : t('exams.startQuiz', 'اختبار الدرس')}</span>
            </Button>
          )}

          {/* Mark Completed Toggle */}
          <Button
            size="sm"
            variant={isCompleted ? 'secondary' : 'primary'}
            onClick={() => toggleCompleteMutation.mutate(Boolean(isCompleted))}
            isLoading={toggleCompleteMutation.isPending}
            className="gap-2 text-xs font-bold"
          >
            <CheckCircle2 className={`w-4 h-4 ${isCompleted ? 'text-emerald-500' : ''}`} />
            <span>{isCompleted ? t('courses.completed') : t('lessons.markComplete')}</span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Column: Modular Curriculum Components */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Lesson Header with official metadata */}
          <LessonHeader
            title={localizeText(lesson.title)}
            code={lesson.code}
            description={localizeText(lesson.description)}
            difficulty={lesson.difficulty}
            estimatedDurationMinutes={lesson.estimatedDurationMinutes}
            authority={lesson.authority || course?.authority}
            curriculumId={activeCourseId}
            curriculumTitle={course ? localizeText(course.title) : undefined}
            chapterTitle={currentSection ? localizeText(currentSection.title) : undefined}
            chapterCode={currentSection?.code}
          />

          {/* 2. Factual Ministry Curriculum & Textbook Provenance Banner */}
          <TextbookProvenance
            authority={lesson.authority || course?.authority}
            academicYear={course?.academicYear}
            term={course?.term}
            track={course?.track}
            pageRange={lesson.pageRange}
          />

          {/* 3. Video / Video Blueprint Player */}
          <VideoBlueprintCard
            videoBlueprint={lesson.videoBlueprint}
            videoUrl={playbackData?.playbackUrl || lesson.video?.playbackUrl || lesson.videoUrl}
            playbackId={playbackData?.playbackId || lesson.video?.playbackId}
            playbackToken={playbackData?.token}
            videoDurationSeconds={playbackData?.durationSeconds || lesson.videoBlueprint?.durationSeconds || lesson.video?.durationSeconds || (lesson.estimatedDurationMinutes ? lesson.estimatedDurationMinutes * 60 : null)}
            lastWatchedPosition={lesson.progress?.lastWatchedPosition || 0}
            onTimeUpdate={handleVideoProgress}
            onVideoEnded={handleVideoEnded}
          />

          {/* 4. Interactive Concept Cards Deck */}
          {lesson.conceptCards && lesson.conceptCards.length > 0 && (
            <ConceptCardsDeck
              cards={lesson.conceptCards}
              onDeckCompleted={() => {
                // Concept deck completed in current session
              }}
            />
          )}

          {/* 5. Rich Markdown Lesson Content */}
          {lesson.content && (
            <Card className="p-6 sm:p-8 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
                {t('lessons.lessonContent')}
              </h2>
              <MarkdownViewer content={lesson.content} />
            </Card>
          )}

          {/* External Presentation Resource (e.g. Canva) */}
          {lesson.externalResourceUrl && (
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-50/50 dark:bg-brand-950/20 p-4 rounded-2xl border border-brand-200/60 dark:border-brand-800/40">
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
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition shrink-0"
              >
                <span>{t('lessons.openResource')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* 6. Applied Engineering Task */}
          {hasEngineeringTask && (
            <EngineeringTaskCard
              task={lesson.engineeringTask}
              onSubmitClick={(t) => navigate(`/student/tasks/${t.id}`)}
            />
          )}

          {/* 7. Advanced Challenge */}
          {hasAdvancedChallenge && (
            <AdvancedChallengeCard
              challenge={lesson.advancedChallenge}
              onSubmitClick={(c) => navigate(`/student/tasks/${c.id}`)}
            />
          )}

          {/* 8. Fallback for Legacy Tasks */}
          {hasLegacyTasks && (
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-600" />
                <span>{t('nav.tasks')} ({lesson.tasks!.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lesson.tasks!.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/student/tasks/${task.id}`)}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-300 transition cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div>
                      <Badge variant="outline" size="sm">{formatStatus(task.difficulty)}</Badge>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-1">{task.title}</h4>
                    </div>
                    <span className="text-[11px] font-bold text-brand-600 flex items-center gap-1">
                      <span>{t('tasks.viewTask')}</span>
                      <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 9. Interactive Quiz Card */}
          {activeQuiz && (
            <Card className="p-5 sm:p-6 border-amber-500/20 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/10 dark:from-amber-950/10 dark:via-slate-900 dark:to-slate-900 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {activeQuiz.title}
                      </h3>
                      {activeQuiz.code && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          {activeQuiz.code}
                        </span>
                      )}
                      {activeQuiz.myAttempt ? (
                        <Badge variant="success" size="sm" className="gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{activeQuiz.myAttempt.percentage}%</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                          +{activeQuiz.xpReward || 30} XP
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {activeQuiz.myAttempt
                        ? 'تم تسليم الاختبار التقييمي بنجاح وحصد نقاط الخبرة. يمكنك مراجعة إجاباتك في أي وقت.'
                        : 'اختبر فهمك لمفاهيم الدرس التفاعلية واحصد نقاط XP الفورية عند تحقيق نسبة النجاح.'}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setIsQuizDrawerOpen(true)}
                  className="gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm shrink-0 w-full sm:w-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeQuiz.myAttempt ? t('exams.reviewAttempt', 'مراجعة الاختبار') : t('exams.startQuiz', 'بدء الاختبار')}</span>
                </Button>
              </div>
            </Card>
          )}

          {/* Navigation Controls: Previous / Next Lesson */}
          <div className="flex items-center justify-between gap-3 pt-4">
            {prevLesson ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/student/courses/${activeCourseId}/lessons/${prevLesson.id}`)
                }
                className="gap-2 max-w-[48%] truncate"
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180 shrink-0" />
                <span className="truncate">{prevLesson.title}</span>
              </Button>
            ) : <div />}

            {nextLesson ? (
              <Button
                size="sm"
                onClick={() => {
                  if (nextLesson.isLocked) {
                    toast.error(nextLesson.lockMessage || t('lessons.lockedExplanation'));
                  } else {
                    navigate(`/student/courses/${activeCourseId}/lessons/${nextLesson.id}`);
                  }
                }}
                className="gap-2 max-w-[48%] truncate"
              >
                <span className="truncate">{nextLesson.title}</span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180 shrink-0" />
              </Button>
            ) : <div />}
          </div>
        </div>

        {/* Right Column: Desktop Syllabus Sidebar */}
        <div className="hidden lg:block lg:col-span-4 sticky top-6 space-y-4">
          <Card className="p-4 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <List className="w-4 h-4 text-brand-600" />
                <span>{t('courses.syllabus')}</span>
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {orderedLessons.filter((l) => l.progress?.status === 'COMPLETED').length}/{orderedLessons.length}
              </span>
            </div>

            {/* Course Sections Tree */}
            <div className="space-y-3">
              {(course?.sections || []).map((sec, sIdx) => (
                <div key={sec.id} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {sIdx + 1}. {localizeText(sec.title)}
                    </h4>
                    {sec.code && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {sec.code}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {(sec.lessons || []).map((l, lIdx) => {
                      const isCurrent = l.id === id;
                      const isDone = l.progress?.status === 'COMPLETED';

                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            if (l.isLocked) {
                              toast.error(l.lockMessage || t('lessons.lockedExplanation'));
                            } else {
                              navigate(`/student/courses/${activeCourseId}/lessons/${l.id}`);
                            }
                          }}
                          className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                            isCurrent
                              ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-500/20'
                              : isDone
                              ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              : l.isLocked
                              ? 'opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-emerald-500'}`} />
                            ) : l.isLocked ? (
                              <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            ) : (
                              <PlayCircle className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-brand-500'}`} />
                            )}
                            <span className="truncate">{localizeText(l.title)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {l.code && (
                              <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                                isCurrent
                                  ? 'border-white/30 text-white'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400'
                              }`}>
                                {l.code}
                              </span>
                            )}
                            <span className={`text-[10px] ${isCurrent ? 'text-brand-100' : 'text-slate-400'}`}>
                              {formatDuration(l.estimatedDurationMinutes)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile Drawer Syllabus */}
      {isMobileSyllabusOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <List className="w-4 h-4 text-brand-600" />
                <span>{t('courses.syllabus')}</span>
              </h3>
              <button
                onClick={() => toggleMobileSyllabus(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {(course?.sections || []).map((sec, sIdx) => (
                <div key={sec.id} className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase px-1">
                    {sIdx + 1}. {localizeText(sec.title)}
                  </h4>
                  <div className="space-y-1">
                    {(sec.lessons || []).map((l) => {
                      const isCurrent = l.id === id;
                      const isDone = l.progress?.status === 'COMPLETED';

                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            toggleMobileSyllabus(false);
                            if (l.isLocked) {
                              toast.error(l.lockMessage || t('lessons.lockedExplanation'));
                            } else {
                              navigate(`/student/courses/${activeCourseId}/lessons/${l.id}`);
                            }
                          }}
                          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                            isCurrent
                              ? 'bg-brand-600 text-white font-bold'
                              : isDone
                              ? 'bg-slate-50 dark:bg-slate-800/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : l.isLocked ? (
                              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <PlayCircle className="w-4 h-4 text-brand-500 shrink-0" />
                            )}
                            <span className="truncate">{localizeText(l.title)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {l.code && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700 text-slate-400">
                                {l.code}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatDuration(l.estimatedDurationMinutes)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Progress Footer */}
      <LessonProgressFooter
        isCompleted={isCompleted}
        progressPercentage={lesson.progress?.progressPercentage || (isCompleted ? 100 : 0)}
        isLocked={lesson.isLocked}
        nextLesson={nextLesson}
        curriculumId={activeCourseId}
        onMarkComplete={async () => {
          await toggleCompleteMutation.mutateAsync(Boolean(isCompleted));
        }}
        isCompleting={toggleCompleteMutation.isPending}
        hasQuiz={Boolean(activeQuiz)}
        quizCompleted={Boolean(activeQuiz?.myAttempt)}
        onOpenQuiz={() => setIsQuizDrawerOpen(true)}
      />

      {/* Quiz Modal / Slide-Out Drawer */}
      <LessonQuizDrawer
        isOpen={isQuizDrawerOpen}
        onClose={() => setIsQuizDrawerOpen(false)}
        quiz={activeQuiz}
        onQuizCompleted={(xpEarned) => {
          queryClient.invalidateQueries({ queryKey: ['studentLesson', id] });
          if (activeCourseId) {
            queryClient.invalidateQueries({ queryKey: ['studentCourseDetail', activeCourseId] });
            queryClient.invalidateQueries({ queryKey: ['studentCourseProgress', activeCourseId] });
          }
          queryClient.invalidateQueries({ queryKey: ['studentCoursesSummary'] });
          toast.success(isRtl ? `تم اجتياز الاختبار وحصد ${xpEarned} XP!` : `Quiz passed! Earned ${xpEarned} XP!`);
        }}
      />
    </div>
  );
}

