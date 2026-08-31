import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Badge } from '../ui/badge.js';
import { useToast } from '../ui/toast.js';
import { Calendar, Clock, CheckCircle2, AlertCircle, Edit3, Sparkles } from 'lucide-react';
import { formatTime12h } from '../../lib/schedule-helpers.js';
import { localizeText, formatDate } from '../../lib/i18n-helpers.js';
import { TodayScheduleGroup } from '../../types/api.js';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGroupId?: string;
}

export function CreateSessionModal({ isOpen, onClose, initialGroupId }: CreateSessionModalProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedGroup, setSelectedGroup] = useState<TodayScheduleGroup | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [customSessionNumber, setCustomSessionNumber] = useState<number | ''>('');

  // Fetch today's scheduled groups
  const { data: todayGroups, isLoading: isLoadingToday } = useQuery({
    queryKey: ['todaySchedule', customDate],
    queryFn: async () => (await api.sessions.getTodaySchedule(customDate)).data.data as TodayScheduleGroup[],
    enabled: isOpen
  });

  // Fetch all groups for manual override / fallback
  const { data: allGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data,
    enabled: isOpen
  });

  useEffect(() => {
    if (todayGroups && todayGroups.length > 0) {
      if (initialGroupId) {
        const found = todayGroups.find((g) => g.groupId === initialGroupId);
        if (found) {
          setSelectedGroup(found);
          setCustomStartTime(found.schedule?.startTime || '16:00');
          setCustomEndTime(found.schedule?.endTime || '17:30');
          setCustomSessionNumber(found.nextSessionNumber);
          return;
        }
      }
      // Default to first scheduled group for today if available
      const firstAvailable = todayGroups.find((g) => !g.existingSession) || todayGroups[0];
      setSelectedGroup(firstAvailable);
      setCustomStartTime(firstAvailable.schedule?.startTime || '16:00');
      setCustomEndTime(firstAvailable.schedule?.endTime || '17:30');
      setCustomSessionNumber(firstAvailable.nextSessionNumber);
    }
  }, [todayGroups, initialGroupId]);

  const handleGroupCardSelect = (groupItem: TodayScheduleGroup) => {
    setSelectedGroup(groupItem);
    setCustomStartTime(groupItem.schedule?.startTime || '16:00');
    setCustomEndTime(groupItem.schedule?.endTime || '17:30');
    setCustomSessionNumber(groupItem.nextSessionNumber);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => (await api.sessions.create(payload)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['todaySchedule'] });
      toast.success(t('common.success'));
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;

    createMutation.mutate({
      groupId: selectedGroup.groupId,
      sessionNumber: customSessionNumber ? Number(customSessionNumber) : selectedGroup.nextSessionNumber,
      date: new Date(customDate).toISOString(),
      startTime: isOverride ? customStartTime : (selectedGroup.schedule?.startTime || customStartTime),
      endTime: isOverride ? customEndTime : (selectedGroup.schedule?.endTime || customEndTime),
      isOverride
    });
  };

  const todayFormattedDate = formatDate(customDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('sessions.createSession') || (isArabic ? 'إنشاء حصة جديدة' : 'Create Session')}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-2">
        {/* Step 1: Today Header */}
        <div className="p-3.5 rounded-2xl bg-brand-50/70 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <div>
              <div className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">
                {isArabic ? 'تاريخ اليوم:' : 'Date:'}
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                {todayFormattedDate}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOverride(!isOverride)}
            className="text-xs text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1.5 hover:underline"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>
              {isOverride
                ? (isArabic ? 'استخدام الجدول التلقائي' : 'Use Scheduled Defaults')
                : (isArabic ? 'تعديل / تجاوز الجدول' : 'Override Schedule')}
            </span>
          </button>
        </div>

        {/* Step 2: Available Scheduled Groups Today */}
        {!isOverride && (
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 block flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{isArabic ? 'المجموعات المجدولة لليوم:' : 'Groups Scheduled Today:'}</span>
            </label>

            {isLoadingToday ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                {isArabic ? 'جاري التحقق من الجدول...' : 'Checking today schedule...'}
              </div>
            ) : todayGroups && todayGroups.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {todayGroups.map((g) => {
                  const isSelected = selectedGroup?.groupId === g.groupId;
                  const hasSession = Boolean(g.existingSession);

                  return (
                    <button
                      key={g.groupId}
                      type="button"
                      onClick={() => handleGroupCardSelect(g)}
                      className={`p-3.5 rounded-2xl text-start transition-all border flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 dark:border-brand-500 shadow-md ring-2 ring-brand-500/30'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div>
                          <div className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{localizeText(g.groupName)}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />}
                          </div>
                          {g.schedule && (
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                              <Clock className="w-3.5 h-3.5 text-brand-500" />
                              <span>
                                {formatTime12h(g.schedule.startTime, isArabic)} – {formatTime12h(g.schedule.endTime, isArabic)}
                              </span>
                            </div>
                          )}
                        </div>

                        <Badge variant={hasSession ? 'secondary' : 'primary'} size="sm">
                          {hasSession
                            ? (isArabic ? `الحصة #${g.existingSession?.sessionNumber}` : `Session #${g.existingSession?.sessionNumber}`)
                            : (isArabic ? `الحصة #${g.nextSessionNumber}` : `Next: #${g.nextSessionNumber}`)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>{g.enrolledStudentsCount} {t('roles.student')}</span>
                        {hasSession ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {isArabic ? 'تم إنشاء الحصة' : 'Session Created'}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">
                            {isArabic ? 'لم تنشأ بعد' : 'Not created yet'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {isArabic
                    ? 'لا يوجد مجموعات ذات جدول مجدول لهذا اليوم. استخدم زر التجاوز لاختيار أي مجموعة يدويًا.'
                    : 'No groups are scheduled for today. Use schedule override to select any group manually.'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Manual Override Options or Confirmation details */}
        {isOverride ? (
          <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <Select
              label={t('students.group')}
              value={selectedGroup?.groupId || ''}
              onChange={(e) => {
                const grp = allGroups?.find((g) => g.id === e.target.value);
                if (grp) {
                  setSelectedGroup({
                    groupId: grp.id,
                    groupName: grp.name,
                    enrolledStudentsCount: grp._count?.enrollments || 0,
                    targetDate: customDate,
                    dayOfWeek: new Date(customDate).getDay(),
                    schedule: grp.schedules?.[0]
                      ? {
                          id: grp.schedules[0].id || '',
                          startTime: grp.schedules[0].startTime,
                          endTime: grp.schedules[0].endTime
                        }
                      : null,
                    nextSessionNumber: (grp._count?.sessions || 0) + 1,
                    existingSession: null
                  });
                }
              }}
              options={[
                { value: '', label: `-- ${t('students.group')} --` },
                ...(allGroups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
              ]}
              required
            />

            <Input
              label={t('sessions.sessionDate')}
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('sessions.startTime')}
                type="time"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                required
              />
              <Input
                label={t('sessions.endTime')}
                type="time"
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
                required
              />
            </div>

            <Input
              label={t('sessions.sessionNumber')}
              type="number"
              value={customSessionNumber}
              onChange={(e) => setCustomSessionNumber(Number(e.target.value))}
              min={1}
              required
            />
          </div>
        ) : (
          selectedGroup && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {isArabic ? 'تفاصيل الحصة التلقائية:' : 'Auto-derived Session Summary:'}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">{t('students.group')}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{localizeText(selectedGroup.groupName)}</span>
                </div>

                <div>
                  <span className="text-slate-500 block">{t('sessions.sessionNumber')}:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    #{customSessionNumber || selectedGroup.nextSessionNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{t('groups.schedule')}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedGroup.schedule
                      ? `${formatTime12h(selectedGroup.schedule.startTime, isArabic)} – ${formatTime12h(selectedGroup.schedule.endTime, isArabic)}`
                      : (isArabic ? 'حسب الإدخال' : 'As set')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{t('roles.student')}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedGroup.enrolledStudentsCount}
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={createMutation.isPending} disabled={!selectedGroup}>
            {t('sessions.createSession')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
