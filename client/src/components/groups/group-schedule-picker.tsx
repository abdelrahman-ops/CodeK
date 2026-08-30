import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DAYS_OF_WEEK, formatScheduleString } from '../../lib/schedule-helpers.js';
import { Clock, Calendar, Check } from 'lucide-react';

interface GroupSchedulePickerProps {
  value: string;
  onChange: (formattedSchedule: string) => void;
}

export function GroupSchedulePicker({ value, onChange }: GroupSchedulePickerProps) {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [selectedDays, setSelectedDays] = useState<string[]>(['SATURDAY', 'MONDAY', 'WEDNESDAY']);
  const [fromTime, setFromTime] = useState('16:00');
  const [toTime, setToTime] = useState('17:30');
  const [isManualMode, setIsManualMode] = useState(false);

  // Initialize from existing value if provided
  useEffect(() => {
    if (value && !isManualMode) {
      // Find days in existing value
      const matchedDays = DAYS_OF_WEEK.filter((d) =>
        value.includes(d.ar) || value.toLowerCase().includes(d.en.toLowerCase())
      ).map((d) => d.id);

      if (matchedDays.length > 0) {
        setSelectedDays(matchedDays);
      }
    }
  }, []);

  // Update parent when days or times change in structured mode
  const handleDayToggle = (dayId: string) => {
    const updated = selectedDays.includes(dayId)
      ? selectedDays.filter((id) => id !== dayId)
      : [...selectedDays, dayId];
    setSelectedDays(updated);
    const str = formatScheduleString(updated, fromTime, toTime, isArabic);
    onChange(str);
  };

  const handleFromTimeChange = (time: string) => {
    setFromTime(time);
    const str = formatScheduleString(selectedDays, time, toTime, isArabic);
    onChange(str);
  };

  const handleToTimeChange = (time: string) => {
    setToTime(time);
    const str = formatScheduleString(selectedDays, fromTime, time, isArabic);
    onChange(str);
  };

  const applyQuickTimePreset = (from: string, to: string) => {
    setFromTime(from);
    setToTime(to);
    const str = formatScheduleString(selectedDays, from, to, isArabic);
    onChange(str);
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span>{t('groups.schedule')}</span>
        </label>

        <button
          type="button"
          onClick={() => setIsManualMode(!isManualMode)}
          className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium underline"
        >
          {isManualMode ? (isArabic ? 'اختيار الأيام والأوقات المنظمة' : 'Use structured picker') : (isArabic ? 'كتابة نص مخصص يدوي' : 'Type custom text')}
        </button>
      </div>

      {isManualMode ? (
        <div>
          <input
            type="text"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={isArabic ? 'مثال: السبت والأربعاء (04:00 م - 05:30 م)' : 'e.g. Saturday, Wednesday (4:00 PM - 5:30 PM)'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Day Selector Chips */}
          <div>
            <div className="text-xs text-slate-500 mb-1.5 font-medium">
              {t('groups.days') || (isArabic ? 'أيام الحصص الأسبوعية' : 'Session Days')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleDayToggle(day.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-600/30'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{isArabic ? day.ar : day.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot (From - To) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">
                {t('groups.fromTime') || (isArabic ? 'من الساعة' : 'From Time')}
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => handleFromTimeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 font-mono font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">
                {t('groups.toTime') || (isArabic ? 'إلى الساعة' : 'To Time')}
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => handleToTimeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 font-mono font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Quick Time Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-medium">{isArabic ? 'أوقات شائعة:' : 'Presets:'}</span>
            <button
              type="button"
              onClick={() => applyQuickTimePreset('16:00', '17:30')}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-slate-700 dark:text-slate-300 font-mono transition-colors"
            >
              4:00 - 5:30 PM
            </button>
            <button
              type="button"
              onClick={() => applyQuickTimePreset('17:30', '19:00')}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-slate-700 dark:text-slate-300 font-mono transition-colors"
            >
              5:30 - 7:00 PM
            </button>
            <button
              type="button"
              onClick={() => applyQuickTimePreset('19:00', '20:30')}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-slate-700 dark:text-slate-300 font-mono transition-colors"
            >
              7:00 - 8:30 PM
            </button>
          </div>

          {/* Formatted Preview */}
          {value && (
            <div className="p-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900/50 flex items-center gap-2 text-xs text-brand-800 dark:text-brand-300">
              <Clock className="w-3.5 h-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <span className="font-bold">{value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
