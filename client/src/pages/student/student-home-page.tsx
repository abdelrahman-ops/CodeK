import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Star,
  Trophy,
  CalendarCheck2,
  BookOpen,
  CheckSquare,
  GraduationCap,
  QrCode,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  PlayCircle,
  HelpCircle,
  Activity,
  Award,
  Crown,
  Check,
  Zap,
  CreditCard
} from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Progress } from '../../components/ui/progress.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { QrScannerModal } from '../../components/shared/qr-scanner-modal.js';
import { CelebrationModal } from '../../components/shared/celebration-modal.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStreak, formatStatus } from '../../lib/i18n-helpers.js';

export function StudentHomePage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ title: string; subtitle: string; xp: number } | null>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: async () => (await api.dashboard.getStudentDashboard()).data.data
  });

  const scanMutation = useMutation({
    mutationFn: async (data: { sessionId: string; token: string; qrToken: string }) =>
      (await api.attendance.confirmStudent(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentDashboard'] });
      setIsScannerOpen(false);
      setCelebrationData({
        title: t('dashboard.attendanceConfirmed'),
        subtitle: t('dashboard.attendanceSuccess'),
        xp: 10
      });
      toast.success(t('dashboard.attendanceSuccess'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleAttendanceScan = (rawScan: string) => {
    let parsedSessionId = todaySession?.sessionId;
    let cleanToken = rawScan.trim();

    try {
      if (rawScan.startsWith('{')) {
        const parsed = JSON.parse(rawScan);
        if (parsed.sessionId) parsedSessionId = parsed.sessionId;
        if (parsed.token) cleanToken = parsed.token;
        if (parsed.qrToken) cleanToken = parsed.qrToken;
      }
    } catch {}

    if (!parsedSessionId) {
      toast.error(t('attendance.noActiveSession'));
      return;
    }

    scanMutation.mutate({
      sessionId: parsedSessionId,
      token: cleanToken,
      qrToken: cleanToken
    });
  };

  if (isLoading) return <CardSkeleton />;

  const student = dashboard?.student || user?.student;
  const continueLearning = dashboard?.continueLearning;
  const tasks = dashboard?.tasks || [];
  const upcomingQuizOrExam = dashboard?.upcomingQuizOrExam;
  const todaySession = dashboard?.todaySession;
  const learningAnalytics = dashboard?.learningAnalytics;
  const metrics = dashboard?.progress || { programming: 0, problemSolving: 0, curriculum: 0, projects: 0, attendance: 0 };
  const achievements = dashboard?.achievements || [];
  const leaderboardPreview = dashboard?.leaderboardPreview || [];

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <Card className="relative overflow-hidden p-6 sm:p-7 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white rounded-3xl shadow-xl shadow-brand-500/10 border-0">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-white mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{student?.studentCode}</span>
              <span>•</span>
              <span className="font-mono">{student?.anonymousLeaderboardCode}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t('common.welcome')}, {user?.firstName}!
            </h1>
            <p className="text-xs sm:text-sm text-brand-100/90 max-w-lg leading-relaxed">
              {t('dashboard.whatToDoSubtitle')}
            </p>
          </div>

          {/* Gamification Stats Pill */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/15">
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 text-center min-w-[76px]">
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300 mb-0.5" />
              <span className="text-base font-black leading-tight">{formatStreak(student?.currentStreak || 0)}</span>
              <span className="text-[10px] text-brand-100 font-semibold">{t('dashboard.streak')}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 text-center min-w-[76px]">
              <Star className="w-4 h-4 text-amber-300 fill-amber-300 mb-0.5" />
              <span className="text-base font-black leading-tight">{student?.totalXp || 0}</span>
              <span className="text-[10px] text-brand-100 font-semibold">{t('dashboard.totalXp')}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 text-center min-w-[76px]">
              <Trophy className="w-4 h-4 text-amber-300 mb-0.5" />
              <span className="text-base font-black leading-tight">#{dashboard?.rank?.rank || 1}</span>
              <span className="text-[10px] text-brand-100 font-semibold">{t('dashboard.rank')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* TIER 0: SUBSCRIPTION STATUS (Commercial Entitlement Command Bar) */}
      {/* ========================================================================= */}
      {(() => {
        const sub = dashboard?.subscription;
        const isActive = sub?.isActive;
        const isExpired = sub?.status === 'EXPIRED';

        const formatDate = (dateStr?: string | null) => {
          if (!dateStr) return '—';
          const d = new Date(dateStr);
          return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        };

        if (isActive) {
          return (
            <Card className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-300/80 dark:border-emerald-800/60 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        {isRtl ? 'اشتراكك الإلكتروني نشط' : 'Your Learning Subscription is Active'}
                      </h3>
                      <Badge variant="success" size="sm">
                        {isRtl ? '250 ج.م / نشط' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {isRtl ? 'صلاحية الوصول مستمرة حتى:' : 'Full access active until:'}{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatDate(sub?.currentPeriodEnd)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/student/subscription')}
                    className="text-xs font-bold"
                  >
                    <span>{isRtl ? 'تفاصيل الاشتراك' : 'Subscription'}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        }

        if (isExpired) {
          return (
            <Card className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 border border-amber-300/80 dark:border-amber-800/60 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        {isRtl ? 'انتهت فترة اشتراكك' : 'Your Subscription Has Expired'}
                      </h3>
                      <Badge variant="warning" size="sm">
                        {isRtl ? 'منتهي' : 'Expired'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-xl">
                      {isRtl
                        ? 'حسابك ومستواك وتقدمك البرمجي محفوظ بالكامل. جدد اشتراكك الآن (250 ج.م / 30 يوماً) لمواصلة التعلم.'
                        : 'Your account, XP, and progress are preserved. Renew now for 250 EGP / 30 days to continue learning.'}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => navigate('/student/subscription')}
                  className="gap-1.5 text-xs font-black shrink-0 bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isRtl ? 'تجديد الاشتراك (250 ج.م)' : 'Renew (250 EGP)'}</span>
                </Button>
              </div>
            </Card>
          );
        }

        // Unsubscribed visitor / student
        return (
          <Card className="p-4 sm:p-5 bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent dark:from-brand-950/30 dark:via-slate-900 dark:to-slate-900 border border-brand-300/80 dark:border-brand-800/60 rounded-2xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      {isRtl ? 'افتح الوصول لجميع المسارات البرمجية' : 'Unlock Full Programming Access'}
                    </h3>
                    <Badge variant="primary" size="sm">
                      {isRtl ? '250 ج.م / 30 يوماً' : '250 EGP / 30 Days'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-xl">
                    {isRtl
                      ? 'اشترك الآن وافتح كافة الدروس، الفيديوهات التطبيقية، المشاريع العملية وقوائم المتصدرين.'
                      : 'Subscribe now to access all lessons, video walkthroughs, hands-on tasks, and the leaderboard.'}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => navigate('/student/subscription')}
                className="gap-1.5 text-xs font-black shrink-0 bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{isRtl ? 'الاشتراك الآن (250 ج.م)' : 'Subscribe (250 EGP)'}</span>
              </Button>
            </div>
          </Card>
        );
      })()}

      {/* ========================================================================= */}
      {/* TIER 1: CONTINUE LEARNING (Primary Student Priority) */}
      {/* ========================================================================= */}
      {continueLearning && (
        <Card className="p-6 sm:p-7 bg-gradient-to-br from-indigo-50/70 via-white to-brand-50/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-brand-950/20 border border-brand-200/80 dark:border-brand-800/60 rounded-3xl shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-brand-600 text-white">
                  <PlayCircle className="w-4 h-4" />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-300">
                  {t('dashboard.tier1Learning', 'متابعة التعلم')}
                </span>
                <Badge variant="outline" size="sm" className="bg-white/80 dark:bg-slate-800 text-[10px]">
                  {continueLearning.courseTitle}
                </Badge>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                  {continueLearning.lessonTitle}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{t('courses.courseProgress')}: {continueLearning.progressPercentage}%</span>
                </div>
              </div>

              <div className="w-full max-w-md">
                <Progress value={continueLearning.progressPercentage} color="brand" className="h-2" />
              </div>
            </div>

            <Button
              size="lg"
              onClick={() =>
                navigate(`/student/courses/${continueLearning.courseId}/lessons/${continueLearning.lessonId}`)
              }
              className="gap-2 text-sm font-black px-6 shadow-md shadow-brand-500/20 shrink-0"
            >
              <PlayCircle className="w-5 h-5" />
              <span>{continueLearning.progressPercentage > 0 ? t('courses.continueWatching') : t('courses.startLearning')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TIER 2: TODAY'S TASKS */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('dashboard.tier2Tasks', 'مهام وتحديات اليوم')}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {tasks.length}
            </span>
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/student/tasks')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400"
          >
            <span>{t('tasks.allTasks')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>

        {tasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {tasks.map((task: any) => {
              const isSubmitted = Boolean(task.mySubmission);
              return (
                <Card
                  key={task.id}
                  className="p-4 sm:p-5 flex flex-col justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-brand-300 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" size="sm">{formatStatus(task.difficulty)}</Badge>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                        +{task.xpReward} XP
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 line-clamp-1">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {task.taskType === 'PROJECT' ? t('nav.projects', 'مشروع عملي') : t('tasks.dailyTask', 'مهمة يومية')}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isSubmitted ? (
                      <Button
                        onClick={() => navigate(`/student/tasks/${task.id}`)}
                        className="w-full text-xs font-bold gap-1"
                        size="sm"
                        variant="outline"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{formatStatus(task.mySubmission.status)}</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => navigate(`/student/tasks/${task.id}`)}
                        className="w-full text-xs font-bold gap-1"
                        size="sm"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{t('common.solveTask')}</span>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-5 text-center text-xs text-slate-500">
            {t('tasks.noActiveTasks', 'لا توجد مهام معلقة اليوم. أحسنت عملاً!')}
          </Card>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TIER 3: UPCOMING QUIZ / EXAM */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>{t('dashboard.tier3Quiz', 'الاختبار القادم')}</span>
        </h2>

        {upcomingQuizOrExam ? (
          <Card className="p-5 sm:p-6 bg-gradient-to-br from-purple-50/50 via-white to-pink-50/30 dark:from-purple-950/20 dark:via-slate-900 dark:to-pink-950/20 border border-purple-200/80 dark:border-purple-800/50 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" className="bg-purple-600 text-white">
                    {upcomingQuizOrExam.isQuiz ? t('exams.quiz', 'اختبار سريع') : t('exams.title', 'امتحان')}
                  </Badge>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    +{upcomingQuizOrExam.xpReward} XP
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {upcomingQuizOrExam.durationMinutes} {t('common.mins')}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  {upcomingQuizOrExam.title}
                </h3>
                {upcomingQuizOrExam.lesson && (
                  <p className="text-xs text-slate-500">
                    {t('nav.lessons')}: {upcomingQuizOrExam.lesson.title}
                  </p>
                )}
              </div>

              <div>
                {upcomingQuizOrExam.myAttempt ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="md" className="text-xs font-bold gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{upcomingQuizOrExam.myAttempt.percentage}%</span>
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/student/exams/${upcomingQuizOrExam.id}`)}
                      className="text-xs font-bold"
                    >
                      {t('exams.reviewAttempt', 'مراجعة الإجابة')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => navigate(`/student/exams/${upcomingQuizOrExam.id}`)}
                    className="gap-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <span>{t('exams.startQuiz', 'ابدأ الاختبار')}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 text-center text-xs text-slate-500">
            {t('dashboard.noUpcomingExams', 'لا توجد اختبارات مجدولة حالياً')}
          </Card>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TIER 4: SATURDAY SESSION & ATTENDANCE (Secondary / Decoupled) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('dashboard.tier4Session', 'جلسة السبت الحضورية')}</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            {t('dashboard.attendanceIndependentNotice', 'الحضور الفعلي منفصل تماماً عن اشتراكك واستمرارية وصولك للدروس')}
          </span>
        </div>

        {dashboard?.student?.attendanceRequired ? (
          <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-2xl">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant={todaySession?.isPresent ? 'success' : 'primary'} size="sm">
                  {todaySession?.isPresent ? t('dashboard.attendanceConfirmed') : t('common.pending')}
                </Badge>
                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded-full">
                  {t('dashboard.attendanceRequiredNotice', 'مطلوب الحضور الفعلي')}
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">+10 XP</span>
              </div>

              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                {todaySession ? `${t('sessions.sessionNumber')} #${todaySession.sessionNumber}` : t('dashboard.step1Attendance')}
              </h3>
              <p className="text-xs text-slate-500">
                {todaySession?.date ? `${todaySession.date} • ${todaySession.startTime} - ${todaySession.endTime}` : t('dashboard.step1AttendanceDesc')}
              </p>
            </div>

            <div>
              {todaySession?.isPresent ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('dashboard.attendanceConfirmed')}</span>
                </div>
              ) : (
                <Button onClick={() => setIsScannerOpen(true)} className="gap-2 text-xs font-bold" size="sm">
                  <QrCode className="w-4 h-4" />
                  <span>{t('dashboard.scanQr')}</span>
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" size="sm" className="bg-white dark:bg-slate-800 text-[10px]">
                  {isRtl ? 'دراسة أونلاين بالكامل' : 'Online Only'}
                </Badge>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                {t('dashboard.onlineStudentNotice', 'طالب بنظام التعلم عبر الإنترنت (أونلاين)')}
              </h3>
              <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                {isRtl
                  ? 'أنت مسجل بنظام التعلم الذاتي عن بُعد؛ وصولك لكافة الدروس، الفيديوهات، والمشاريع متاح 24/7 دون الحاجة للحضور بمقر الأكاديمية.'
                  : 'You are enrolled in the online-first learning model with 24/7 access to all courses and projects.'}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/student/courses')}
              className="text-xs font-bold gap-1.5 shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('courses.title')}</span>
            </Button>
          </Card>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TIER 5: PROGRESS & MEANINGFUL LEARNING ANALYTICS */}
      {/* ========================================================================= */}
      <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <CardTitle className="text-base font-black">{t('dashboard.tier5Analytics', 'مستوى التقدم والإحصائيات')}</CardTitle>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/student/progress')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400"
          >
            <span>{t('common.viewAll')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>

        {learningAnalytics ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.courseProgress')}</span>
              <span className="text-lg font-black text-brand-600 dark:text-brand-400 mt-1 block">
                {learningAnalytics.courseProgress}%
              </span>
              <Progress value={learningAnalytics.courseProgress} color="brand" className="h-1.5 mt-2" />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.lessonsCompleted')}</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {learningAnalytics.lessonsCompleted.completed} / {learningAnalytics.lessonsCompleted.total}
              </span>
              <Progress value={learningAnalytics.lessonsCompleted.percentage} color="success" className="h-1.5 mt-2" />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.tasksCompleted')}</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {learningAnalytics.tasksCompleted.completed} / {learningAnalytics.tasksCompleted.total}
              </span>
              <Progress value={learningAnalytics.tasksCompleted.percentage} color="accent" className="h-1.5 mt-2" />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.quizPerformance')}</span>
              <span className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1 block">
                {learningAnalytics.quizPerformance.attempted > 0 ? `${learningAnalytics.quizPerformance.averageScore}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                {learningAnalytics.quizPerformance.attempted} {t('exams.quiz', 'اختبار')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.examPerformance')}</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {learningAnalytics.examPerformance.attempted > 0 ? `${learningAnalytics.examPerformance.averageScore}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                {learningAnalytics.examPerformance.attempted} {t('exams.title', 'امتحان')}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{t('progress.programming')}</span>
                <span>{metrics.programming}%</span>
              </div>
              <Progress value={metrics.programming} color="brand" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{t('progress.problemSolving')}</span>
                <span>{metrics.problemSolving}%</span>
              </div>
              <Progress value={metrics.problemSolving} color="accent" />
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* TIER 6: XP & ACHIEVEMENTS */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>{t('dashboard.tier6Achievements', 'نقاط الخبرة والإنجازات')}</span>
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/student/achievements')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400"
          >
            <span>{t('common.viewAll')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {achievements.slice(0, 4).map((ach: any) => (
            <Card key={ach.id} className="p-3.5 flex items-center gap-3 border-slate-200/80 dark:border-slate-800/80">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                  {ach.name}
                </h4>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {t('achievements.unlocked')}
                </span>
              </div>
            </Card>
          ))}
          {achievements.length === 0 && (
            <div className="col-span-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500">
              {t('achievements.keepGoing', 'أكمل الدروس والمهام لتحصل على أول أوسمتك!')}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIER 7: LEADERBOARD (Strict Anonymous Privacy Mode) */}
      {/* ========================================================================= */}
      <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-base font-black">{t('dashboard.tier7Leaderboard', 'لوحة الصدارة والشرف')}</CardTitle>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/student/leaderboard')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400"
          >
            <span>{t('leaderboard.rankings')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>

        <div className="space-y-2">
          {leaderboardPreview.map((peer: any) => (
            <div
              key={peer.rank}
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold transition ${
                peer.isCurrentStudent
                  ? 'bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-200'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-black">{peer.rank}</span>
                <span className="font-mono">{peer.anonymousCode}</span>
                {peer.isCurrentStudent && (
                  <Badge variant="primary" size="sm" className="text-[10px]">
                    {t('leaderboard.you', 'أنت')}
                  </Badge>
                )}
              </div>
              <span className="text-amber-600 dark:text-amber-400">
                {peer.monthlyXp} XP
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* QR Code Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(token) => handleAttendanceScan(token)}
        isLoading={scanMutation.isPending}
      />

      {/* Celebration Modal on attendance/XP award */}
      {celebrationData && (
        <CelebrationModal
          isOpen={Boolean(celebrationData)}
          onClose={() => setCelebrationData(null)}
          title={celebrationData.title}
          subtitle={celebrationData.subtitle}
          xpEarned={celebrationData.xp}
        />
      )}
    </div>
  );
}
