import React, { useState } from 'react';
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
import { formatTime12h } from '../../lib/schedule-helpers.js';
import { CreateSessionModal } from '../../components/sessions/create-session-modal.js';

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedModalGroupId, setSelectedModalGroupId] = useState<string | undefined>();

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

  const todayScheduledGroups = dashboard?.todayScheduledGroups || [];
  const sessions = dashboard?.upcomingOrActiveSessions || [];
  const activity = dashboard?.recentActivity || [];

  const handleOpenCreateModalForGroup = (groupId?: string) => {
    setSelectedModalGroupId(groupId);
    setIsCreateModalOpen(true);
  };

  const todayDateStr = formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
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
          <Button variant="outline" onClick={() => handleOpenCreateModalForGroup()}>
            <CalendarCheck2 className="w-4 h-4" />
            <span>{t('sessions.createSession')}</span>
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

      {/* TODAY'S SCHEDULED CLASSES CARD */}
      <Card className="p-6 space-y-4 border-brand-200/60 dark:border-brand-900/50 bg-gradient-to-br from-brand-50/30 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{isArabic ? 'جدول حصص اليوم' : "Today's Scheduled Classes"}</span>
                <span className="text-xs font-normal text-slate-500">• {todayDateStr}</span>
              </h2>
              <p className="text-xs text-slate-500">
                {isArabic ? 'المجموعات التي لديهم حصص مجدولة اليوم حسب جدول الأكاديمية' : 'Groups with scheduled classes today based on weekly schedule'}
              </p>
            </div>
          </div>

          <Button size="sm" onClick={() => handleOpenCreateModalForGroup()}>
            <CalendarCheck2 className="w-4 h-4" />
            <span>{t('sessions.createSession')}</span>
          </Button>
        </div>

        {todayScheduledGroups.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            {isArabic ? 'لا توجد حصص مجدولة لهذا اليوم' : 'No recurring group classes scheduled for today.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {todayScheduledGroups.map((item) => {
              const hasSession = Boolean(item.existingSession);

              return (
                <div
                  key={item.groupId}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                          {localizeText(item.groupName)}
                        </h3>
                        {item.schedule && (
                          <div className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 mt-0.5">
                            <span>{formatTime12h(item.schedule.startTime, isArabic)} – {formatTime12h(item.schedule.endTime, isArabic)}</span>
                          </div>
                        )}
                      </div>

                      <Badge variant={hasSession ? 'success' : 'warning'} size="sm">
                        {hasSession
                          ? (isArabic ? `الحصة #${item.existingSession?.sessionNumber}` : `Session #${item.existingSession?.sessionNumber}`)
                          : (isArabic ? 'الحصة لم تنشأ' : 'Session not created')}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                      {item.enrolledStudentsCount} {t('roles.student')}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    {hasSession ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/admin/sessions/${item.existingSession?.id}/qr`)}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'فتح الحصة (QR)' : 'Open Session (QR)'}</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleOpenCreateModalForGroup(item.groupId)}
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        <span>{t('sessions.createSession')}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

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
                        {formatDate(sess.date)} • {formatTime12h(sess.startTime, isArabic)} - {formatTime12h(sess.endTime, isArabic)} • {sess.presentAttendanceCount} {t('sessions.presentCount')}
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
                      <span className="text-[11px] text-slate-400">
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

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialGroupId={selectedModalGroupId}
      />
    </div>
  );
}
