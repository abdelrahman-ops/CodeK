export interface DayOption {
  id: string;
  dayIndex: number; // 0 for Sunday, 6 for Saturday (matches JS Date.getDay())
  ar: string;
  en: string;
}

export const DAYS_OF_WEEK: DayOption[] = [
  { id: 'SATURDAY', dayIndex: 6, ar: 'السبت', en: 'Saturday' },
  { id: 'SUNDAY', dayIndex: 0, ar: 'الأحد', en: 'Sunday' },
  { id: 'MONDAY', dayIndex: 1, ar: 'الاثنين', en: 'Monday' },
  { id: 'TUESDAY', dayIndex: 2, ar: 'الثلاثاء', en: 'Tuesday' },
  { id: 'WEDNESDAY', dayIndex: 3, ar: 'الأربعاء', en: 'Wednesday' },
  { id: 'THURSDAY', dayIndex: 4, ar: 'الخميس', en: 'Thursday' },
  { id: 'FRIDAY', dayIndex: 5, ar: 'الجمعة', en: 'Friday' }
];

export interface ScheduleSlot {
  dayId: string;
  dayIndex: number;
  dayName: string;
  fromTime: string;
  toTime: string;
  label: string;
}

/**
 * Format 24h time ("16:00") into 12h localized string ("4:00 م" / "4:00 PM")
 */
export function formatTime12h(timeStr: string | null | undefined, isArabic = false): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  if (!clean.includes(':')) return clean;

  // Extract hour & minute
  const match = clean.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm|ص|م))?$/i);
  if (!match) return clean;

  let h = parseInt(match[1], 10);
  const m = match[2];
  const existingPeriod = match[3];

  if (isNaN(h)) return clean;

  // If period is already present (e.g. "4:00 PM" or "4:00 م")
  if (existingPeriod) {
    const isPM = /م|pm/i.test(existingPeriod);
    if (isArabic) {
      return `${h}:${m} ${isPM ? 'م' : 'ص'}`;
    }
    return `${h}:${m} ${isPM ? 'PM' : 'AM'}`;
  }

  // 24-hour conversion
  const isPM = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;

  if (isArabic) {
    return `${h}:${m} ${isPM ? 'م' : 'ص'}`;
  }
  return `${h}:${m} ${isPM ? 'PM' : 'AM'}`;
}

/**
 * Format any schedule text string (e.g. "Saturday 16:00-17:30") to 12h format ("Saturday 4:00 PM - 5:30 PM" or "السبت 4:00 م - 5:30 م")
 */
export function formatScheduleText(text: string | null | undefined, isArabic = false): string {
  if (!text) return '';
  let result = text.trim();

  // 1. Replace 24h time ranges: e.g. "16:00-17:30" or "16:00 - 17:30" or "04:00-05:30"
  result = result.replace(/(\b\d{1,2}:\d{2}\b)\s*[-–—]\s*(\b\d{1,2}:\d{2}\b)(?:\s*(AM|PM|am|pm|ص|م))?/g, (_match, t1, t2, period) => {
    if (period) {
      return `${formatTime12h(`${t1} ${period}`, isArabic)} - ${formatTime12h(`${t2} ${period}`, isArabic)}`;
    }
    return `${formatTime12h(t1, isArabic)} - ${formatTime12h(t2, isArabic)}`;
  });

  // 2. Replace standalone 24h times: e.g. "at 16:00" -> "at 4:00 PM" (if not already followed by AM/PM/م/ص)
  result = result.replace(/(\b\d{1,2}:\d{2}\b)(?!\s*(?:AM|PM|am|pm|ص|م|\s*[-–—]))/g, (_match, t) => {
    return formatTime12h(t, isArabic);
  });

  // 3. Localize day names & punctuation
  if (isArabic) {
    result = result
      .replace(/\bSaturday\b/gi, 'السبت')
      .replace(/\bSunday\b/gi, 'الأحد')
      .replace(/\bMonday\b/gi, 'الاثنين')
      .replace(/\bTuesday\b/gi, 'الثلاثاء')
      .replace(/\bWednesday\b/gi, 'الأربعاء')
      .replace(/\bThursday\b/gi, 'الخميس')
      .replace(/\bFriday\b/gi, 'الجمعة')
      .replace(/\bAM\b/gi, 'ص')
      .replace(/\bPM\b/gi, 'م')
      .replace(/,\s*/g, ' ، ');
  } else {
    result = result
      .replace(/السبت/g, 'Saturday')
      .replace(/الأحد/g, 'Sunday')
      .replace(/الإثنين|الاثنين/g, 'Monday')
      .replace(/الثلاثاء/g, 'Tuesday')
      .replace(/الأربعاء/g, 'Wednesday')
      .replace(/الخميس/g, 'Thursday')
      .replace(/الجمعة/g, 'Friday')
      .replace(/\s*م\b/g, ' PM')
      .replace(/\s*ص\b/g, ' AM')
      .replace(/،\s*/g, ', ');
  }

  return result;
}

/**
 * Build human-readable formatted string from structured group schedule list in 12h
 */
export function formatScheduleFromList(
  schedules?: { dayOfWeek: number; startTime: string; endTime: string }[] | null,
  isArabic = false
): string {
  if (!schedules || schedules.length === 0) return '';
  const sorted = [...schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  // If all days have identical hours, group them
  const firstTime = `${sorted[0].startTime}-${sorted[0].endTime}`;
  const allSameTime = sorted.every((s) => `${s.startTime}-${s.endTime}` === firstTime);

  if (allSameTime && sorted.length > 1) {
    const days = sorted
      .map((s) => {
        const dayObj = DAYS_OF_WEEK.find((d) => d.dayIndex === s.dayOfWeek);
        return dayObj ? (isArabic ? dayObj.ar : dayObj.en) : '';
      })
      .filter(Boolean);

    const joinedDays = isArabic ? days.join('، ') : days.join(', ');
    const fromFmt = formatTime12h(sorted[0].startTime, isArabic);
    const toFmt = formatTime12h(sorted[0].endTime, isArabic);
    return `${joinedDays} ${fromFmt} - ${toFmt}`;
  }

  return sorted
    .map((s) => {
      const dayObj = DAYS_OF_WEEK.find((d) => d.dayIndex === s.dayOfWeek);
      const dayName = dayObj ? (isArabic ? dayObj.ar : dayObj.en) : '';
      const fromFmt = formatTime12h(s.startTime, isArabic);
      const toFmt = formatTime12h(s.endTime, isArabic);
      return `${dayName} ${fromFmt} - ${toFmt}`;
    })
    .join(isArabic ? ' ، ' : ', ');
}

/**
 * Format schedule display resolving from schedules array or fallback scheduleInfo string
 */
export function formatScheduleDisplay(
  schedules?: { dayOfWeek: number; startTime: string; endTime: string }[] | null,
  fallbackScheduleInfo?: string | null,
  isArabic = false
): string {
  if (schedules && schedules.length > 0) {
    return formatScheduleFromList(schedules, isArabic);
  }
  return formatScheduleText(fallbackScheduleInfo, isArabic);
}

/**
 * Build human-readable formatted string for scheduleInfo from selected days and time range
 */
export function formatScheduleString(
  selectedDays: string[],
  fromTime: string,
  toTime: string,
  isArabic = true
): string {
  if (!selectedDays.length) return '';

  const dayNames = selectedDays.map((dId) => {
    const found = DAYS_OF_WEEK.find((d) => d.id === dId || d.en.toLowerCase() === dId.toLowerCase() || d.ar === dId);
    return found ? (isArabic ? found.ar : found.en) : dId;
  });

  const daysJoined = isArabic ? dayNames.join('، ') : dayNames.join(', ');
  const fromFormatted = formatTime12h(fromTime, isArabic);
  const toFormatted = formatTime12h(toTime, isArabic);

  return `${daysJoined} ${fromFormatted} - ${toFormatted}`;
}

/**
 * Parse any scheduleInfo string into actionable slots for session creation
 */
export function parseScheduleSlots(scheduleInfo?: string | null, isArabic = true): ScheduleSlot[] {
  if (!scheduleInfo || !scheduleInfo.trim()) return [];

  const text = scheduleInfo.trim();
  const slots: ScheduleSlot[] = [];

  // Extract times in parentheses e.g. (04:00 م - 05:30 م) or (16:00 - 17:30) or 16:00 - 17:30
  const timeMatch = text.match(/\((.*?)\)/) || text.match(/(\d{1,2}:\d{2}.*?-\s*\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm|ص|م))?)/);
  let fromTime = '17:00';
  let toTime = '18:30';

  if (timeMatch && timeMatch[1]) {
    const parts = timeMatch[1].split('-').map((s) => s.trim());
    if (parts.length >= 2) {
      fromTime = convertTo24h(parts[0]) || fromTime;
      toTime = convertTo24h(parts[1]) || toTime;
    }
  }

  // Detect which days of the week are mentioned in text
  for (const d of DAYS_OF_WEEK) {
    if (
      text.includes(d.ar) ||
      text.toLowerCase().includes(d.en.toLowerCase()) ||
      text.toUpperCase().includes(d.id)
    ) {
      const fromFmt = formatTime12h(fromTime, isArabic);
      const toFmt = formatTime12h(toTime, isArabic);
      const dayName = isArabic ? d.ar : d.en;

      slots.push({
        dayId: d.id,
        dayIndex: d.dayIndex,
        dayName,
        fromTime,
        toTime,
        label: `${dayName} (${fromFmt} - ${toFmt})`
      });
    }
  }

  return slots;
}

/**
 * Convert localized time string (e.g. "4:00 م" or "4:00 PM" or "16:00") to 24h "HH:MM"
 */
function convertTo24h(str: string): string | null {
  if (!str) return null;
  const isPM = /م|pm/i.test(str);
  const isAM = /ص|am/i.test(str);

  const clean = str.replace(/[^\d:]/g, '').trim();
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';

  if (isNaN(h)) return null;

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  const hh = h < 10 ? `0${h}` : `${h}`;
  return `${hh}:${m}`;
}

/**
 * Get the next upcoming Date string (YYYY-MM-DD) for a specific JS dayIndex (0=Sun, 6=Sat)
 */
export function getNextDayOfWeekDate(targetDayIndex: number): string {
  const today = new Date();
  const currentDayIndex = today.getDay();
  let daysUntil = targetDayIndex - currentDayIndex;

  if (daysUntil < 0) {
    daysUntil += 7;
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntil);

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
