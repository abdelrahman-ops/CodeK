import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { Trophy, Star, CheckCircle2, Award } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatXp } from '../../lib/i18n-helpers.js';

export function AdminLeaderboardPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'semester'>('monthly');
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['adminLeaderboard', period],
    queryFn: async () => (await api.gamification.getLeaderboard({ period })).data.data
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      return (await api.gamification.finalizeLeaderboard({ year: now.getFullYear(), month: now.getMonth() + 1 })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLeaderboard'] });
      setIsFinalizeDialogOpen(false);
      toast.success(t('leaderboard.monthlyRevealed'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (isLoading) return <CardSkeleton />;

  const entries = leaderboard?.entries || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            <span>{t('nav.leaderboard')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('leaderboard.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl">
            {(['weekly', 'monthly', 'semester'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize ${period === p ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                {t(`leaderboard.${p}`)}
              </button>
            ))}
          </div>

          {period === 'monthly' && leaderboard?.status !== 'FINALIZED' && (
            <Button
              onClick={() => setIsFinalizeDialogOpen(true)}
              isLoading={finalizeMutation.isPending}
            >
              <Trophy className="w-4 h-4" />
              <span>{t('leaderboard.finalizeMonth')}</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <CardTitle className="text-base">{t('leaderboard.rankings')}</CardTitle>
          <Badge variant={leaderboard?.status === 'FINALIZED' ? 'success' : 'primary'}>
            {formatStatus(leaderboard?.status || 'ACTIVE')}
          </Badge>
        </div>

        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.studentId || entry.anonymousCode}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 text-center font-semibold text-base text-slate-500">
                  #{entry.rank}
                </span>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {entry.studentName || t('roles.student')}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {entry.studentCode} • {entry.anonymousCode}
                  </div>
                </div>
              </div>

              <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{entry.monthlyXp} XP</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={isFinalizeDialogOpen}
        onClose={() => setIsFinalizeDialogOpen(false)}
        onConfirm={() => finalizeMutation.mutate()}
        title={t('leaderboard.finalizeMonth')}
        description={t('leaderboard.finalizeConfirmPrompt')}
        isDestructive={false}
        isLoading={finalizeMutation.isPending}
      />
    </div>
  );
}
