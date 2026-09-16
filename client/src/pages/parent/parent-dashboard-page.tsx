import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Flame,
  Star,
  GraduationCap,
  CalendarCheck2,
  CheckSquare,
  CreditCard,
  Clock,
  Presentation,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  HelpCircle,
  Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Progress } from '../../components/ui/progress.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { StatCard } from '../../components/ui/stat-card.js';
import { ParentDashboardData, ParentChildSummary } from '../../types/api.js';
import { localizeText, formatStatus, formatStreak } from '../../lib/i18n-helpers.js';

export function ParentDashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  const { data: dashboard, isLoading } = useQuery<ParentDashboardData>({
    queryKey: ['parentDashboard'],
    queryFn: async () => (await api.dashboard.getParentDashboard()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  const children = dashboard?.children || [];
  const currentChild: ParentChildSummary | undefined = children[selectedChildIndex];

  if (!currentChild || children.length === 0) {
    return (
      <Card className="p-8 text-center space-y-3">
        <Users className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
          {t('common.noData')}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {t('parents.subtitle')}
        </p>
      </Card>
    );
  }

  const metrics = currentChild.progress || {
    attendance: 100,
    programming: 75,
    problemSolving: 80,
    curriculum: 70,
    projects: 65
  };

  const counts = currentChild.counts || {
    approvedDailyTasks: 0,
    totalDailyTasks: 0,
    presentSessions: 0,
    totalCompletedSessions: 0
  };

  const isPaid = currentChild.currentMonthPayment?.status === 'PAID';

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {t('common.welcome')}, {user?.firstName}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('parents.subtitle')}
          </p>
        </div>

        {/* Multi-child Switcher (Large touch-friendly tabs) */}
        {children.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl">
            {children.map((child: ParentChildSummary, idx: number) => (
              <button
                key={child.studentId}
                onClick={() => setSelectedChildIndex(idx)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition select-none flex items-center gap-1.5 ${selectedChildIndex === idx ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                <Avatar name={child.displayName} size="sm" />
                <span>{child.displayName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Child Hero Card */}
      <Card className="p-5 sm:p-7 bg-gradient-to-br from-brand-900 via-slate-900 to-brand-950 text-white rounded-3xl shadow-xl border-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={currentChild.displayName} src={currentChild.avatarUrl} size="lg" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold mb-1">
                <span>{localizeText(currentChild.activeGroup?.name) || t('students.group')}</span>
                <span>•</span>
                <span className="font-mono">{currentChild.studentCode}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black">{currentChild.displayName}</h2>
              <div className="text-xs text-brand-200 mt-0.5">
                {t('students.programmingLevel')}: {formatStatus(currentChild.programmingLevel)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white/10 text-center min-w-[76px]">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400 mx-auto mb-1" />
              <div className="text-base sm:text-lg font-black">{formatStreak(currentChild.currentStreak)}</div>
              <div className="text-[10px] text-slate-300 font-bold">{t('dashboard.streak')}</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 text-center min-w-[76px]">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 mx-auto mb-1" />
              <div className="text-base sm:text-lg font-black">{currentChild.totalXp}</div>
              <div className="text-[10px] text-slate-300 font-bold">{t('dashboard.totalXp')}</div>
            </div>
          </div>
        </div>

        {/* Group and Schedule Time Slot Banner */}
        {currentChild.activeGroup && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-brand-200">
              <Presentation className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="font-bold">{localizeText(currentChild.activeGroup.name)}</span>
            </div>

            {currentChild.activeGroup.scheduleInfo && (
              <div className="flex items-center gap-2 text-amber-300 font-medium">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{localizeText(currentChild.activeGroup.scheduleInfo)}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* High-level Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title={t('progress.attendance')}
          value={`${Math.min(100, metrics.attendance)}%`}
          subtitle={t('parents.physicalSessions')}
          icon={<CalendarCheck2 className="w-5 h-5 text-brand-600" />}
        />
        <StatCard
          title={t('parents.homeworkSolved')}
          value={`${counts.approvedDailyTasks} / ${counts.totalDailyTasks}`}
          subtitle={t('parents.approvedSolutions')}
          icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title={t('parents.latestExam')}
          value={currentChild.latestExam ? `${currentChild.latestExam.percentage}%` : t('common.noData')}
          subtitle={localizeText(currentChild.latestExam?.examTitle) || t('exams.title')}
          icon={<GraduationCap className="w-5 h-5 text-brand-600" />}
        />
        <StatCard
          title={t('parents.tuitionStatus')}
          value={isPaid ? t('payments.paid') : t('payments.unpaid')}
          subtitle={t('parents.currentMonth')}
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Meaningful Learning Analytics (Phase 4) */}
      {currentChild.learningAnalytics && (
        <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-2xl">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <CardTitle className="text-base font-black">
              {t('dashboard.tier5Analytics', 'مستوى التقدم الدراسي والإحصائيات')}
            </CardTitle>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.courseProgress')}</span>
              <span className="text-lg font-black text-brand-600 dark:text-brand-400 mt-1 block">
                {currentChild.learningAnalytics.courseProgress}%
              </span>
              <Progress value={currentChild.learningAnalytics.courseProgress} color="brand" className="h-1.5 mt-2" />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.lessonsCompleted')}</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {currentChild.learningAnalytics.lessonsCompleted.completed} / {currentChild.learningAnalytics.lessonsCompleted.total}
              </span>
              <Progress value={currentChild.learningAnalytics.lessonsCompleted.percentage} color="success" className="h-1.5 mt-2" />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.tasksCompleted')}</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {currentChild.learningAnalytics.tasksCompleted.completed} / {currentChild.learningAnalytics.tasksCompleted.total}
              </span>
              <Progress value={currentChild.learningAnalytics.tasksCompleted.percentage} color="accent" className="h-1.5 mt-2" />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.quizPerformance')}</span>
              <span className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1 block">
                {currentChild.learningAnalytics.quizPerformance.attempted > 0 ? `${currentChild.learningAnalytics.quizPerformance.averageScore}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                {currentChild.learningAnalytics.quizPerformance.attempted} {t('exams.quiz', 'اختبار')}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block">{t('dashboard.examPerformance')}</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {currentChild.learningAnalytics.examPerformance.attempted > 0 ? `${currentChild.learningAnalytics.examPerformance.averageScore}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                {currentChild.learningAnalytics.examPerformance.attempted} {t('exams.title', 'امتحان')}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* 4-Dimension Skill Progression */}
      <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <CardTitle className="text-base font-black">
          {t('progress.title')} — {currentChild.displayName}
        </CardTitle>

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
              <span>{t('progress.projects')}</span>
              <span>{metrics.projects}%</span>
            </div>
            <Progress value={metrics.projects} color="purple" />
          </div>
        </div>
      </Card>
    </div>
  );
}
