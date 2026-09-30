import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context.js';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/card.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Users2, Award, Star, Flame, Trophy, Target, Sparkles, Zap } from 'lucide-react';
import { localizeText } from '../../lib/i18n-helpers.js';

function getAchievementIcon(iconName: string) {
  const normalized = (iconName || '').toLowerCase();
  if (normalized.includes('fire') || normalized.includes('flame')) return <Flame className="w-3.5 h-3.5 text-amber-500" />;
  if (normalized.includes('trophy') || normalized.includes('project')) return <Trophy className="w-3.5 h-3.5 text-yellow-500" />;
  if (normalized.includes('target') || normalized.includes('challenge')) return <Target className="w-3.5 h-3.5 text-emerald-500" />;
  if (normalized.includes('star') || normalized.includes('exam')) return <Star className="w-3.5 h-3.5 text-brand-500" />;
  if (normalized.includes('zap')) return <Zap className="w-3.5 h-3.5 text-amber-400" />;
  return <Award className="w-3.5 h-3.5 text-brand-500" />;
}

export function MyGroupPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const activeGroup = user?.student?.enrollments?.[0]?.group || null;
  const activeGroupId = activeGroup?.id;

  const { data: groupData, isLoading } = useQuery({
    queryKey: ['myGroup', activeGroupId],
    queryFn: async () => {
      if (!activeGroupId) return null;
      const res = await api.groups.getById(activeGroupId);
      return res.data.data;
    },
    enabled: Boolean(activeGroupId)
  });

  if (isLoading) return <CardSkeleton />;

  if (!groupData) {
    return (
      <EmptyState
        icon={<Users2 className="w-8 h-8" />}
        title={t('groups.noActiveGroup')}
        description={t('groups.noActiveGroupDesc')}
      />
    );
  }

  const members = groupData.members || [];

  return (
    <div className="space-y-6">
      {/* Group Header Card */}
      <Card className="bg-gradient-to-r from-brand-600 via-brand-700 to-brand-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold mb-2">
              <Users2 className="w-3.5 h-3.5" />
              <span>{members.length} {t('groups.classmates')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{localizeText(groupData.name)}</h1>
            <p className="text-sm text-brand-100/90 mt-1">{localizeText(groupData.scheduleInfo) || localizeText(groupData.description)}</p>
          </div>
        </div>
      </Card>

      {/* Classmates Grid (Privacy Strictly Respected: Avatar, Display Name, Achievement Badges only) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('groups.classmatesCommunity')}</span>
            <Badge variant="primary" size="sm">{members.length}</Badge>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {members.map((member) => (
            <Card key={member.studentId} className="p-4 flex flex-col justify-between gap-3 hover:border-brand-300 dark:hover:border-brand-700 transition">
              <div className="flex items-center gap-3">
                <Avatar name={member.displayName} src={member.avatarUrl} size="md" />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {member.displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Sparkles className="w-3 h-3 text-brand-500" />
                    <span>{t('groups.classmate')}</span>
                  </div>
                </div>
              </div>

              {/* Achievement Badges (Lucide SVG icons only) */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  {t('nav.achievements')}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {member.achievements && member.achievements.length > 0 ? (
                    member.achievements.map((ach) => (
                      <div
                        key={ach.id}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                        title={localizeText(ach.name)}
                      >
                        {getAchievementIcon(ach.icon)}
                        <span className="truncate max-w-[90px]">{localizeText(ach.name)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      {t('achievements.noAchievementsYet')}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
