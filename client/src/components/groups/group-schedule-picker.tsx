import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DAYS_OF_WEEK, formatTime12h } from '../../lib/schedule-helpers.js';
import { GroupSchedule } from '../../types/api.js';
import { Calendar, Clock, Sparkles, Trash2, Check } from 'lucide-react';

interface GroupSchedulePickerProps {
  schedules?: GroupSchedule[];
  onChange: (schedules: GroupSchedule[]) => void;
}

const PRESETS = [
  { start: '16:00', end: '17:30', labelEn: '4:00 - 5:30 PM', labelAr: '4:00 م - 5:30 م' },
  { start: '17:30', end: '19:00', labelEn: '5:30 - 7:00 PM', labelAr: '5:30 م - 7:00 م' },
  { start: '19:00', end: '20:30', labelEn: '7:00 - 8:30 PM', labelAr: '7:00 م - 8:30 م' }
];

export function GroupSchedulePicker({ schedules = [], onChange }: GroupSchedulePickerProps) {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // Internal state of schedule entries: map of dayIndex (0..6) -> { startTime, endTime }
  const [scheduleMap, setScheduleMap] = useState<Record<number, { startTime: string; endTime: string }>>(() => {
    const map: Record<number, { startTime: string; endTime: string }> = {};
    if (schedules && schedules.length > 0) {
      schedules.forEach((s) => {
        map[s.dayOfWeek] = { startTime: s.startTime, endTime: s.endTime };
      });
    }
    return map;
  });

  const [defaultStart, setDefaultStart] = useState('16:00');
  const [defaultEnd, setDefaultEnd] = useState('17:30');

  useEffect(() => {
    const list: GroupSchedule[] = Object.entries(scheduleMap).map(([dayOfWeek, time]) => ({
      dayOfWeek: parseInt(dayOfWeek, 10),
      startTime: time.startTime,
      endTime: time.endTime,
      isActive: true
    }));
    onChange(list);
  }, [scheduleMap]);

  const toggleDay = (dayIndex: number) => {
    setScheduleMap((prev) => {
      const next = { ...prev };
      if (next[dayIndex]) {
        delete next[dayIndex];
      } else {
        next[dayIndex] = { startTime: defaultStart, endTime: defaultEnd };
      }
      return next;
    });
  };

  const updateDayTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setScheduleMap((prev) => {
      if (!prev[dayIndex]) return prev;
      return {
        ...prev,
        [dayIndex]: {
          ...prev[dayIndex],
          [field]: value
        }
      };
    });
  };

  const applyPresetToAllSelected = (start: string, end: string) => {
    setDefaultStart(start);
    setDefaultEnd(end);
    setScheduleMap((prev) => {
      const next: Record<number, { startTime: string; endTime: string }> = {};
      Object.keys(prev).forEach((key) => {
        const d = parseInt(key, 10);
        next[d] = { startTime: start, endTime: end };
      });
      return next;
    });
  };

  const activeDaysCount = Object.keys(scheduleMap).length;

  const countBadgeText = isArabic
    ? activeDaysCount === 0
      ? 'لم يتم تحديد أيام'
      : activeDaysCount === 1
      ? 'يوم محدد'
      : activeDaysCount === 2
      ? 'يومان محددان'
      : activeDaysCount >= 3 && activeDaysCount <= 10
      ? `${activeDaysCount} أيام محددة`
      : `${activeDaysCount} يوم محدد`
    : `${activeDaysCount} ${activeDaysCount === 1 ? 'day selected' : 'days selected'}`;

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/70">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
            <Calendar className="w-4 h-4" />
          </div>
          <span>{isArabic ? 'جدول ومواعيد الحصص بالقاعة' : 'Classroom Schedule Slots'}</span>
        </label>
        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            activeDaysCount > 0
              ? 'bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
          }`}
        >
          {countBadgeText}
        </span>
      </div>

      {/* Days Selection Bar */}
      <div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-medium">
          {isArabic ? 'اختر أيام الحصص في الأسبوع للمجموعة:' : 'Select days of the week for this group:'}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = !!scheduleMap[day.dayIndex];
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleDay(day.dayIndex)}
                className={`py-2 px-1.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 ring-2 ring-brand-500/40 scale-[1.02]'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{isArabic ? day.ar : day.en}</span>
                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Presets Bar */}
      {activeDaysCount > 0 && (
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{isArabic ? 'تطبيق توقيت سريع لجميع الأيام المحددة:' : 'Apply quick preset to all selected days:'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.start}
                type="button"
                onClick={() => applyPresetToAllSelected(p.start, p.end)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50/60 dark:hover:bg-brand-950 text-slate-800 dark:text-slate-200 text-xs font-medium transition-all group flex items-center gap-1.5"
              >
                <Clock className="w-3 h-3 text-slate-400 group-hover:text-brand-500" />
                <span dir="ltr" className="font-mono font-bold tracking-tight">
                  {isArabic ? p.labelAr : p.labelEn}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Structured Day Time Inputs */}
      {activeDaysCount === 0 ? (
        <div className="p-4 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 italic">
          {isArabic ? 'اضغط على أيام الأسبوع أعلاه لتعيين أوقات الحصص' : 'Click the days above to configure class times'}
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
            {isArabic ? 'توقيت كل يوم على حدة:' : 'Individual Day Schedules:'}
          </div>
          {DAYS_OF_WEEK.filter((d) => scheduleMap[d.dayIndex]).map((day) => {
            const time = scheduleMap[day.dayIndex];
            return (
              <div
                key={day.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-xs"
              >
                {/* Day Label */}
                <div className="flex items-center gap-2 min-w-[110px]">
                  <div className="w-6 h-6 rounded-md bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {isArabic ? day.ar : day.en}
                  </span>
                </div>

                {/* Time Inputs */}
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 font-bold">{isArabic ? 'من' : 'From'}</span>
                    <input
                      type="time"
                      value={time.startTime}
                      onChange={(e) => updateDayTime(day.dayIndex, 'startTime', e.target.value)}
                      dir="ltr"
                      className="bg-transparent text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                      required
                    />
                  </div>

                  <span className="text-slate-400 font-bold text-xs">-</span>

                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 font-bold">{isArabic ? 'إلى' : 'To'}</span>
                    <input
                      type="time"
                      value={time.endTime}
                      onChange={(e) => updateDayTime(day.dayIndex, 'endTime', e.target.value)}
                      dir="ltr"
                      className="bg-transparent text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                      required
                    />
                  </div>

                  {/* 12h Formatted Pill */}
                  <div
                    dir="ltr"
                    className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900 text-xs font-mono font-bold whitespace-nowrap ml-auto rtl:mr-auto rtl:ml-0"
                  >
                    {formatTime12h(time.startTime, isArabic)} – {formatTime12h(time.endTime, isArabic)}
                  </div>
                </div>

                {/* Delete/Remove Day */}
                <button
                  type="button"
                  onClick={() => toggleDay(day.dayIndex)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 self-end sm:self-center"
                  title={isArabic ? 'إلغاء هذا اليوم' : 'Remove day'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
