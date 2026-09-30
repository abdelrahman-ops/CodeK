import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Lock,
  CheckCircle2,
  Star,
  Flame,
  GraduationCap,
  CheckSquare,
  Trophy,
  Sparkles,
  Zap,
  Target
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Achievement } from '../../types/api.js';
import { localizeText, formatXp, formatDate } from '../../lib/i18n-helpers.js';

export function AchievementsPage() {
  const { t } = useTranslation();

  const { data: achievements, isLoading } = useQuery<Achievement[]>({
    queryKey: ['achievements'],
    queryFn: async () => (await api.gamification.getAchievements()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  const getAchievementIcon = (code: string, icon?: string) => {
    const c = (code || '').toUpperCase();
    const i = (icon || '').toLowerCase();
    if (c.includes('STREAK') || i.includes('flame') || i.includes('fire')) {
      return <Flame className="w-6 h-6 text-amber-500 fill-amber-500" />;
    }
    if (c.includes('EXAM') || c.includes('ACE') || i.includes('star')) {
      return <Star className="w-6 h-6 text-brand-500 fill-brand-500" />;
    }
    if (c.includes('PROJECT') || i.includes('trophy')) {
      return <Trophy className="w-6 h-6 text-amber-500 fill-amber-500" />;
    }
    if (c.includes('CHALLENGE') || c.includes('TASK') || i.includes('target')) {
      return <Target className="w-6 h-6 text-emerald-500" />;
    }
    if (c.includes('ZAP') || i.includes('zap')) {
      return <Zap className="w-6 h-6 text-amber-400" />;
    }
    return <Award className="w-6 h-6 text-brand-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Award className="w-7 h-7 text-brand-600 dark:text-brand-400" />
          <span>{t('achievements.title')}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('achievements.subtitle')}
        </p>
      </div>

      {(!achievements || achievements.length === 0) ? (
        <EmptyState
          icon={<Award className="w-8 h-8" />}
          title={t('achievements.noAchievementsYet')}
          description={t('achievements.noAchievementsDesc')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {achievements.map((ach) => (
            <Card
              key={ach.id}
              className={`p-5 sm:p-6 flex flex-col justify-between gap-4 transition ${ach.isUnlocked ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm' : 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50'}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
                    {getAchievementIcon(ach.code)}
                  </div>
                  <Badge variant={ach.isUnlocked ? 'warning' : 'secondary'} size="sm">
                    {ach.isUnlocked ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{t('achievements.unlocked')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>{t('achievements.locked')}</span>
                      </span>
                    )}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                    {localizeText(ach.name)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{localizeText(ach.description)}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {formatXp(ach.xpReward)}
                </span>
                {ach.unlockedAt && (
                  <span className="text-slate-400 text-[11px]">
                    {formatDate(ach.unlockedAt)}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
