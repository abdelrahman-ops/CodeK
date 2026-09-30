import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  BookOpen,
  CheckSquare,
  GraduationCap,
  QrCode,
  CheckCircle2,
  Lock,
  ArrowRight,
  Flame,
  Star,
  Clock,
  Sparkles
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { QrScannerModal } from '../../components/shared/qr-scanner-modal.js';
import { CelebrationModal } from '../../components/shared/celebration-modal.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatXp } from '../../lib/i18n-helpers.js';

export function TodayPage() {
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
    let parsedSessionId = dashboard?.todaySession?.sessionId;
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

  const todaySession = dashboard?.todaySession;
  const unlockedLesson = dashboard?.todayLessons?.find((l) => !l.isLocked) || dashboard?.todayLessons?.[0];
  const pendingTask = dashboard?.tasks?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <CalendarCheck2 className="w-7 h-7 text-brand-600 dark:text-brand-400" />
          <span>{t('nav.today')}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('dashboard.whatToDoSubtitle')}
        </p>
      </div>

      {/* 4-Step Pipeline Vertical / Horizontal Timeline */}
      <div className="space-y-4">
        {/* STEP 1 */}
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-semibold text-base shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {t('dashboard.step1Attendance')}
                </h3>
                <Badge variant={todaySession?.isPresent ? 'success' : 'primary'} size="sm">
                  {todaySession?.isPresent ? t('dashboard.attendanceConfirmed') : t('common.locked')}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('dashboard.step1AttendanceDesc')}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            {todaySession?.isPresent ? (
              <div className="p-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('dashboard.attendanceConfirmed')} (+10 XP)</span>
              </div>
            ) : (
              <Button onClick={() => setIsScannerOpen(true)} className="w-full sm:w-auto">
                <QrCode className="w-4 h-4" />
                <span>{t('dashboard.scanQr')}</span>
              </Button>
            )}
          </div>
        </Card>

        {/* STEP 2 */}
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-semibold text-base shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {unlockedLesson ? localizeText(unlockedLesson.title) : t('dashboard.step2Lesson')}
                </h3>
                <Badge variant={unlockedLesson && !unlockedLesson.isLocked ? 'success' : 'secondary'} size="sm">
                  {unlockedLesson && !unlockedLesson.isLocked ? t('common.unlocked') : t('common.locked')}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {unlockedLesson ? localizeText(unlockedLesson.description) || t('dashboard.step2LessonDesc') : t('dashboard.lockedLesson')}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            {unlockedLesson && !unlockedLesson.isLocked ? (
              <Button
                onClick={() => navigate(`/student/lessons/${unlockedLesson.id}`)}
                className="w-full sm:w-auto"
                variant="outline"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t('lessons.openLesson')}</span>
              </Button>
            ) : (
              <div className="p-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('lessons.lessonLocked')}</span>
              </div>
            )}
          </div>
        </Card>

        {/* STEP 3 */}
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-semibold text-base shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {pendingTask ? localizeText(pendingTask.title) : t('dashboard.step3Task')}
                </h3>
                <Badge variant="primary" size="sm">+{pendingTask?.xpReward || 30} XP</Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('dashboard.step3TaskDesc')}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <Button
              onClick={() => navigate(pendingTask ? `/student/tasks/${pendingTask.id}` : '/student/tasks')}
              className="w-full sm:w-auto"
            >
              <CheckSquare className="w-4 h-4" />
              <span>{pendingTask ? t('common.solveTask') : t('nav.tasks')}</span>
            </Button>
          </div>
        </Card>

        {/* STEP 4 */}
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-semibold text-base shrink-0 mt-0.5">
              4
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {t('dashboard.step4Exam')}
                </h3>
                <Badge variant="primary" size="sm">+{t('scoring.examTitle')} +100 XP</Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('dashboard.step4ExamDesc')}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <Button
              onClick={() => navigate('/student/exams')}
              className="w-full sm:w-auto"
              variant="outline"
            >
              <GraduationCap className="w-4 h-4" />
              <span>{t('nav.exams')}</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* QR Scanner */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(token) => handleAttendanceScan(token)}
        isLoading={scanMutation.isPending}
      />

      {/* Celebration */}
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
