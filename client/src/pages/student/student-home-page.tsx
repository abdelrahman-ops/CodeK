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
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Progress } from '../../components/ui/progress.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { QrScannerModal } from '../../components/shared/qr-scanner-modal.js';
import { CelebrationModal } from '../../components/shared/celebration-modal.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStreak, formatXp } from '../../lib/i18n-helpers.js';

export function StudentHomePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
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
  const metrics = dashboard?.progress || { programming: 0, problemSolving: 0, curriculum: 0, projects: 0, attendance: 0 };
  const todaySession = dashboard?.todaySession;
  const unlockedLesson = dashboard?.todayLessons?.find((l) => !l.isLocked) || dashboard?.todayLessons?.[0];
  const pendingTask = dashboard?.tasks?.[0];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero Welcome Card */}
      <Card className="relative overflow-hidden p-5 sm:p-7 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white rounded-3xl shadow-xl shadow-brand-500/10 border-0">
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

          {/* Gamification Stats Pill (Zero emojis) */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/15">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/10 text-center min-w-[72px]">
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300 mb-0.5" />
              <span className="text-base font-black leading-tight">{formatStreak(student?.currentStreak || 0)}</span>
              <span className="text-[10px] text-brand-100 font-semibold">{t('dashboard.streak')}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/10 text-center min-w-[72px]">
              <Star className="w-4 h-4 text-amber-300 fill-amber-300 mb-0.5" />
              <span className="text-base font-black leading-tight">{student?.totalXp || 0}</span>
              <span className="text-[10px] text-brand-100 font-semibold">{t('dashboard.totalXp')}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/10 text-center min-w-[72px]">
              <Trophy className="w-4 h-4 text-amber-300 mb-0.5" />
              <span className="text-base font-black leading-tight">#{dashboard?.rank?.rank || 1}</span>
              <span className="text-[10px] text-brand-100 font-semibold">{t('dashboard.rank')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* TODAY'S MISSION PIPELINE (Mobile-first Scannable Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('dashboard.whatToDoToday')}</span>
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/student/today')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400"
          >
            <span>{t('common.details')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Step 1: Session Attendance */}
          <Card className="p-4 sm:p-5 flex flex-col justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={todaySession?.isPresent ? 'success' : 'primary'} size="sm">
                  {todaySession?.isPresent ? t('dashboard.attendanceConfirmed') : t('common.locked')}
                </Badge>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">+10 XP</span>
              </div>

              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {t('dashboard.step1Attendance')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {todaySession ? `${t('sessions.sessionNumber')} #${todaySession.sessionNumber}` : t('dashboard.step1AttendanceDesc')}
                </p>
              </div>
            </div>

            <div>
              {todaySession?.isPresent ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('dashboard.attendanceConfirmed')}</span>
                </div>
              ) : (
                <Button onClick={() => setIsScannerOpen(true)} className="w-full" size="sm">
                  <QrCode className="w-4 h-4" />
                  <span>{t('dashboard.scanQr')}</span>
                </Button>
              )}
            </div>
          </Card>

          {/* Step 2: Unlocked Lesson */}
          <Card className="p-4 sm:p-5 flex flex-col justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={unlockedLesson && !unlockedLesson.isLocked ? 'success' : 'secondary'} size="sm">
                  {unlockedLesson && !unlockedLesson.isLocked ? t('common.unlocked') : t('common.locked')}
                </Badge>
                <span className="text-xs font-bold text-slate-400">{t('nav.lessons')}</span>
              </div>

              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {unlockedLesson ? localizeText(unlockedLesson.title) : t('dashboard.step2Lesson')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {unlockedLesson ? localizeText(unlockedLesson.description) || t('dashboard.step2LessonDesc') : t('dashboard.lockedLesson')}
                </p>
              </div>
            </div>

            <div>
              {unlockedLesson && !unlockedLesson.isLocked ? (
                <Button
                  onClick={() => navigate(`/student/lessons/${unlockedLesson.id}`)}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t('lessons.openLesson')}</span>
                </Button>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('lessons.lessonLocked')}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Step 3: Daily Task */}
          <Card className="p-4 sm:p-5 flex flex-col justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="primary" size="sm">+{pendingTask?.xpReward || 30} XP</Badge>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {t('nav.tasks')}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {pendingTask ? localizeText(pendingTask.title) : t('dashboard.step3Task')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {t('dashboard.step3TaskDesc')}
                </p>
              </div>
            </div>

            <div>
              {pendingTask ? (
                <Button
                  onClick={() => navigate(`/student/tasks/${pendingTask.id}`)}
                  className="w-full"
                  size="sm"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{t('common.solveTask')}</span>
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/student/tasks')}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{t('tasks.allTasks')}</span>
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Progress & Skill Matrix (Clean Mobile-friendly Bars) */}
      <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black">{t('progress.title')}</CardTitle>
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

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>{t('progress.curriculum')}</span>
              <span>{metrics.curriculum}%</span>
            </div>
            <Progress value={metrics.curriculum} color="success" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>{t('progress.attendance')}</span>
              <span>{metrics.attendance}%</span>
            </div>
            <Progress value={metrics.attendance} color="purple" />
          </div>
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
