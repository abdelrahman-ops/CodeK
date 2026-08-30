import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Presentation,
  CalendarCheck2,
  FileCheck2,
  CreditCard,
  History,
  ArrowRight,
  QrCode,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { StatCard } from '../../components/ui/stat-card.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { AdminDashboardData } from '../../types/api.js';
import { localizeText, formatStatus, formatCurrency, formatDate } from '../../lib/i18n-helpers.js';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: dashboard, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ['adminDashboard'],
    queryFn: async () => (await api.dashboard.getAdminDashboard()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  const overview = dashboard?.overview || {
    totalStudents: 0,
    totalParents: 0,
    totalGroups: 0,
    pendingSubmissionsCount: 0,
    activeExamsCount: 0
  };

  const financial = dashboard?.financialSummary || {
    totalCollectedEgp: 0,
    totalExpectedEgp: 0,
    paidCount: 0,
    unpaidCount: 0,
    totalRecords: 0
  };

  const sessions = dashboard?.upcomingOrActiveSessions || [];
  const activity = dashboard?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {t('dashboard.commandCenter')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('dashboard.commandCenterSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/admin/students')}>
            <Users className="w-4 h-4" />
            <span>{t('common.addStudent')}</span>
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/sessions')}>
            <CalendarCheck2 className="w-4 h-4" />
            <span>{t('common.scheduleSession')}</span>
          </Button>
        </div>
      </div>

      {/* Top Stat Pillars */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('common.totalStudents')}
          value={overview.totalStudents}
          subtitle={`${overview.totalGroups} ${t('common.activeGroups')}`}
          icon={<Users className="w-5 h-5 text-brand-600" />}
        />
        <StatCard
          title={t('common.pendingReviews')}
          value={overview.pendingSubmissionsCount}
          subtitle={t('common.tasksWaitingFeedback')}
          icon={<FileCheck2 className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title={t('common.collectedTuition')}
          value={formatCurrency(financial.totalCollectedEgp)}
          subtitle={`${t('common.ofExpected')} ${formatCurrency(financial.totalExpectedEgp)}`}
          icon={<CreditCard className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title={t('common.activeExams')}
          value={overview.activeExamsCount}
          subtitle={t('common.monthlyAssessments')}
          icon={<GraduationCap className="w-5 h-5 text-brand-600" />}
        />
      </div>

      {/* Sessions & Submissions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active & Today's Sessions */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('common.upcomingSessions')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/sessions')}>
                {t('common.viewAll')}
              </Button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                {t('common.noUpcomingSessions')}
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {localizeText(sess.groupName)} — {t('sessions.sessionNumber')} #{sess.sessionNumber}
                        </h4>
                        <Badge variant={sess.status === 'ACTIVE' ? 'success' : 'primary'} size="sm">
                          {formatStatus(sess.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDate(sess.date)} • {sess.startTime} - {sess.endTime} • {sess.presentAttendanceCount} {t('sessions.presentCount')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/admin/sessions/${sess.id}/qr`)}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{t('common.projectorQr')}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Live Activity Stream */}
        <div>
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <span>{t('common.recentActivity')}</span>
            </CardTitle>

            <div className="space-y-3 max-h-[380px] overflow-y-auto">
              {activity.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  {t('common.noActivityYet')}
                </div>
              ) : (
                activity.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                      <span>{log.action}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {log.entityType} {log.actor ? `(${log.actor.firstName})` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
