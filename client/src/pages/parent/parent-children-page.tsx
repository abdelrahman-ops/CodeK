import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/card.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Users, Flame, Star, Trophy, Clock, Presentation, CreditCard } from 'lucide-react';
import { ParentDashboardData } from '../../types/api.js';
import { localizeText, formatStreak, formatCurrency } from '../../lib/i18n-helpers.js';

export function ParentChildrenPage() {
  const { t } = useTranslation();

  const { data: dashboard, isLoading } = useQuery<ParentDashboardData>({
    queryKey: ['parentDashboard'],
    queryFn: async () => (await api.dashboard.getParentDashboard()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  const children = dashboard?.children || [];

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-8 h-8" />}
        title={t('common.noData')}
        description={t('parents.subtitle')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t('parents.linkedChildren')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('parents.overviewDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map((child) => (
          <Card key={child.studentId} className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={child.displayName} src={child.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 truncate">
                  {child.displayName}
                </h3>
                <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="font-bold">{child.studentCode}</span>
                  <span>•</span>
                  <span>{localizeText(child.activeGroup?.name) || t('students.group')}</span>
                </div>
              </div>
            </div>

            {child.activeGroup?.scheduleInfo && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="font-medium">{localizeText(child.activeGroup.scheduleInfo)}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-400 font-medium">{t('progress.attendance')}</span>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {Math.min(100, child.progress.attendance)}%
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-400 font-medium">{t('dashboard.streak')}</span>
                <div className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatStreak(child.currentStreak)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-400 font-medium">{t('dashboard.totalXp')}</span>
                <div className="font-bold text-brand-600 dark:text-brand-400 mt-0.5">
                  {child.totalXp}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ParentPaymentsPage() {
  const { t } = useTranslation();

  const { data: dashboard, isLoading } = useQuery<ParentDashboardData>({
    queryKey: ['parentDashboard'],
    queryFn: async () => (await api.dashboard.getParentDashboard()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  const children = dashboard?.children || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t('payments.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('payments.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {children.map((child) => {
          const payment = child.currentMonthPayment;
          const isPaid = payment?.status === 'PAID';

          return (
            <Card key={child.studentId} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={child.displayName} src={child.avatarUrl} size="md" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {child.displayName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {child.studentCode} • {localizeText(child.activeGroup?.name) || t('students.group')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-end">
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {payment?.amount !== undefined && payment?.amount !== null ? formatCurrency(payment.amount) : '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('parents.currentMonth')}
                  </div>
                </div>

                <Badge variant={isPaid ? 'success' : 'warning'}>
                  {isPaid ? t('payments.paid') : t('payments.unpaid')}
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
