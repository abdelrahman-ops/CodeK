import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DAYS_OF_WEEK, formatTime12h } from '../../lib/schedule-helpers.js';
import { GroupSchedule } from '../../types/api.js';
import { Calendar, Clock, Plus, Trash2, Copy } from 'lucide-react';

interface GroupSchedulePickerProps {
  schedules?: GroupSchedule[];
  onChange: (schedules: GroupSchedule[]) => void;
}

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

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span>{t('groups.schedule') || (isArabic ? 'جدول الحصص الأسبوعي' : 'Weekly Schedule')}</span>
        </label>
        <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
          {activeDaysCount} {isArabic ? 'أيام ممررة' : 'days selected'}
        </span>
      </div>

      {/* Days Selector Row */}
      <div>
        <div className="text-xs text-slate-500 mb-2 font-medium">
          {isArabic ? 'اختر أيام الحصص في الأسبوع:' : 'Select days of week:'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = !!scheduleMap[day.dayIndex];
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleDay(day.dayIndex)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-600/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{isArabic ? day.ar : day.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Presets Bar */}
      {activeDaysCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Copy className="w-3 h-3 text-slate-400" />
            {isArabic ? 'تطبيق توقيت سريع للأيام المحددة:' : 'Apply time preset to all:'}
          </span>
          <button
            type="button"
            onClick={() => applyPresetToAllSelected('16:00', '17:30')}
            className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-brand-50 hover:border-brand-300 text-slate-700 dark:text-slate-300 font-mono font-medium transition-colors"
          >
            4:00 - 5:30 PM
          </button>
          <button
            type="button"
            onClick={() => applyPresetToAllSelected('17:30', '19:00')}
            className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-brand-50 hover:border-brand-300 text-slate-700 dark:text-slate-300 font-mono font-medium transition-colors"
          >
            5:30 - 7:00 PM
          </button>
          <button
            type="button"
            onClick={() => applyPresetToAllSelected('19:00', '20:30')}
            className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-brand-50 hover:border-brand-300 text-slate-700 dark:text-slate-300 font-mono font-medium transition-colors"
          >
            7:00 - 8:30 PM
          </button>
        </div>
      )}

      {/* Structured Day Time Inputs */}
      {activeDaysCount === 0 ? (
        <div className="p-3 text-center text-xs text-slate-400 italic">
          {isArabic ? 'انقر على أيام الأسبوع أعلاه لتحديد جدول الحصص' : 'Click days above to set schedule times'}
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {DAYS_OF_WEEK.filter((d) => scheduleMap[d.dayIndex]).map((day) => {
            const time = scheduleMap[day.dayIndex];
            return (
              <div
                key={day.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <div className="w-24 font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>{isArabic ? day.ar : day.en}</span>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <input
                    type="time"
                    value={time.startTime}
                    onChange={(e) => updateDayTime(day.dayIndex, 'startTime', e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                  <span className="text-xs text-slate-400 font-bold">-</span>
                  <input
                    type="time"
                    value={time.endTime}
                    onChange={(e) => updateDayTime(day.dayIndex, 'endTime', e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>

                <div className="text-[11px] font-medium text-slate-500 hidden sm:block">
                  {formatTime12h(time.startTime, isArabic)} – {formatTime12h(time.endTime, isArabic)}
                </div>

                <button
                  type="button"
                  onClick={() => toggleDay(day.dayIndex)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                  title={isArabic ? 'إزالة اليوم' : 'Remove day'}
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
