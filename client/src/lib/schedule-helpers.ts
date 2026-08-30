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
 * Format 24h time ("16:00") into 12h localized string ("04:00 م" / "4:00 PM")
 */
export function formatTime12h(timeStr: string, isArabic = true): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;

  const isPM = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;

  const paddedH = h < 10 ? `0${h}` : `${h}`;
  if (isArabic) {
    return `${paddedH}:${m} ${isPM ? 'م' : 'ص'}`;
  }
  return `${h}:${m} ${isPM ? 'PM' : 'AM'}`;
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

  return `${daysJoined} (${fromFormatted} - ${toFormatted})`;
}

/**
 * Parse any scheduleInfo string into actionable slots for session creation
 */
export function parseScheduleSlots(scheduleInfo?: string | null, isArabic = true): ScheduleSlot[] {
  if (!scheduleInfo || !scheduleInfo.trim()) return [];

  const text = scheduleInfo.trim();
  const slots: ScheduleSlot[] = [];

  // Extract times in parentheses e.g. (04:00 م - 05:30 م) or (16:00 - 17:30)
  const timeMatch = text.match(/\((.*?)\)/);
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
 * Convert localized time string (e.g. "04:00 م" or "4:00 PM" or "16:00") to 24h "HH:MM"
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
