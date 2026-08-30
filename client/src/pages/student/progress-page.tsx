import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context.js';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Flame, Star, Trophy, CheckSquare, CalendarCheck2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Progress } from '../../components/ui/progress.js';
import { StatCard } from '../../components/ui/stat-card.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { formatStreak } from '../../lib/i18n-helpers.js';

export function ProgressPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const studentId = user?.student?.id;

  const { data: progressData, isLoading } = useQuery({
    queryKey: ['studentProgress', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      return (await api.students.getProgress(studentId)).data.data;
    },
    enabled: Boolean(studentId)
  });

  if (isLoading) return <CardSkeleton />;

  const metrics = progressData?.metrics || {
    programming: 75,
    problemSolving: 60,
    curriculum: 80,
    projects: 50,
    attendance: 90
  };

  const counts = progressData?.counts || {
    approvedDailyTasks: 5,
    totalDailyTasks: 7,
    approvedChallenges: 2,
    totalChallenges: 3,
    approvedProjects: 1,
    totalProjects: 2,
    presentSessions: 4,
    totalCompletedSessions: 4
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          {t('progress.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('progress.subtitle')}
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.streak')}
          value={formatStreak(user?.student?.currentStreak || 0)}
          icon={<Flame className="w-5 h-5 text-amber-500 fill-amber-500" />}
        />
        <StatCard
          title={t('dashboard.totalXp')}
          value={user?.student?.totalXp || 0}
          icon={<Star className="w-5 h-5 text-brand-500 fill-brand-500" />}
        />
        <StatCard
          title={t('parents.homeworkSolved')}
          value={`${counts.approvedDailyTasks} / ${counts.totalDailyTasks}`}
          icon={<CheckSquare className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          title={t('progress.attendance')}
          value={`${metrics.attendance}%`}
          icon={<CalendarCheck2 className="w-5 h-5 text-brand-500" />}
        />
      </div>

      {/* 4 Dimension Progress Card */}
      <Card className="p-6 space-y-6">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-lg">{t('progress.skillDimensions')}</CardTitle>
        </CardHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-200">
              <span>{t('progress.programming')}</span>
              <span>{metrics.programming}%</span>
            </div>
            <Progress value={metrics.programming} color="brand" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-200">
              <span>{t('progress.problemSolving')}</span>
              <span>{metrics.problemSolving}%</span>
            </div>
            <Progress value={metrics.problemSolving} color="accent" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-200">
              <span>{t('progress.curriculum')}</span>
              <span>{metrics.curriculum}%</span>
            </div>
            <Progress value={metrics.curriculum} color="success" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-200">
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
