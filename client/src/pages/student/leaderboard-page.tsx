import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  Star,
  Shield,
  Flame,
  Medal,
  Award,
  Info,
  Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { cn } from '../../lib/utils.js';
import { formatStatus } from '../../lib/i18n-helpers.js';

export function LeaderboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'semester'>('monthly');

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => (await api.gamification.getLeaderboard({ period })).data.data
  });

  if (isLoading) return <CardSkeleton />;

  const entries = leaderboard?.entries || [];
  const isFinalized = leaderboard?.status === 'FINALIZED';
  const myEntry = entries.find((e) => e.isCurrentStudent);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 flex items-center justify-center font-semibold text-sm shadow-sm">
          #1
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-semibold text-sm shadow-sm">
          #2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-500 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-semibold text-sm shadow-sm">
          #3
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-amber-500" />
            <span>{t('leaderboard.title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('leaderboard.subtitle')}
          </p>
        </div>

        {/* Time Period Selector [ Weekly ] [ Monthly ] [ Semester ] */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition select-none',
              period === 'weekly'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            {t('leaderboard.weekly')}
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition select-none',
              period === 'monthly'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            {t('leaderboard.monthly')}
          </button>
          <button
            type="button"
            onClick={() => setPeriod('semester')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition select-none',
              period === 'semester'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            {t('leaderboard.semester')}
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/70 text-brand-800 dark:text-brand-300 text-xs flex items-start gap-2.5 leading-relaxed">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-brand-600 dark:text-brand-400" />
        <span>{t('leaderboard.privacyNotice')}</span>
      </div>

      {/* Student's Own High-contrast Highlight Card */}
      {myEntry && (
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 text-white rounded-3xl shadow-lg border-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center font-semibold text-xl">
                #{myEntry.rank}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-300">
                  {t('leaderboard.yourRank')}
                </div>
                <div className="text-lg sm:text-xl font-semibold">{user?.firstName} {user?.lastName} ({t('leaderboard.you')})</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  {t('auth.loginId')}: {myEntry.anonymousCode}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 text-center min-w-[80px]">
              <Star className="w-4 h-4 text-amber-300 fill-amber-300 mx-auto mb-1" />
              <div className="text-lg sm:text-xl font-semibold">{myEntry.monthlyXp}</div>
              <div className="text-[11px] text-slate-300 font-bold">XP</div>
            </div>
          </div>
        </Card>
      )}

      {/* Leaderboard Table / Cards */}
      <Card className="p-4 sm:p-6 space-y-3 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm sm:text-base font-semibold">
            {isFinalized ? t('leaderboard.finalized') : t('leaderboard.rankings')}
          </CardTitle>
          <Badge variant={isFinalized ? 'success' : 'primary'} size="sm">
            {formatStatus(leaderboard?.status || 'ACTIVE')}
          </Badge>
        </div>

        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.isCurrentStudent;

            return (
              <div
                key={entry.studentId || `${entry.rank}-${entry.anonymousCode}`}
                className={cn(
                  'p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3',
                  isMe
                    ? 'bg-brand-50/70 dark:bg-brand-950/50 border-brand-300 dark:border-brand-800 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60'
                )}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {getRankBadge(entry.rank)}

                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {isMe ? (
                        <>
                          <span>{entry.studentName || `${user?.firstName} ${user?.lastName}`}</span>
                          <Badge variant="primary" size="sm">{t('leaderboard.you')}</Badge>
                        </>
                      ) : isFinalized && entry.studentName ? (
                        <span>{entry.studentName}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tracking-wider">
                            {entry.anonymousCode}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-semibold select-none">
                            {t('leaderboard.anonymous')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {isMe ? entry.anonymousCode : `#${entry.rank}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  {entry.monthlyXp !== null ? (
                    <span>{entry.monthlyXp} XP</span>
                  ) : (
                    <span className="font-mono tracking-widest text-slate-400">•••• XP</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
