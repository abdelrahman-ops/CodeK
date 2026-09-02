import i18n from '../i18n/index.js';

export const KNOWN_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  // Curriculum
  'Egyptian Baccalaureate Programming & AI': {
    ar: 'برمجة البكالوريا المصرية والذكاء الاصطناعي',
    en: 'Egyptian Baccalaureate Programming & AI'
  },
  'Official curriculum for Egyptian Baccalaureate secondary students.': {
    ar: 'المنهج الرسمي المعتمد لطلاب مرحلة البكالوريا المصرية الثانوية.',
    en: 'Official curriculum for Egyptian Baccalaureate secondary students.'
  },
  'Explore Egyptian Baccalaureate programming tracks, coding modules, and physical classroom sessions.': {
    ar: 'استكشف مسارات برمجة البكالوريا المصرية، والوحدات التعليمية، وحصص التدريب العملي بالقاعة.',
    en: 'Explore Egyptian Baccalaureate programming tracks, coding modules, and physical classroom sessions.'
  },
  'Fundamentals & AI': {
    ar: 'الأساسيات والذكاء الاصطناعي',
    en: 'Fundamentals & AI'
  },

  // Lessons
  'Lesson 1: Variables, Data Types, and Expressions': {
    ar: 'الدرس 1: المتغيرات وأنواع البيانات والتعبيرات',
    en: 'Lesson 1: Variables, Data Types, and Expressions'
  },
  'Understanding primitive data types, memory allocation, and expressions in Python and C++.': {
    ar: 'فهم أنواع البيانات الأولية، وتخصيص الذاكرة، والتعبيرات الحسابية في بايثون وC++.',
    en: 'Understanding primitive data types, memory allocation, and expressions in Python and C++.'
  },
  'Lesson 2: Control Flow & Conditionals': {
    ar: 'الدرس 2: التحكم في التدفق والجمل الشرطية',
    en: 'Lesson 2: Control Flow & Conditionals'
  },
  'Branching logic using if, else if, and else statements.': {
    ar: 'المنطق التفرعي باستخدام جمل if وelse if وelse.',
    en: 'Branching logic using if, else if, and else statements.'
  },
  "Lesson 3: Loops & Iterations (Today's Mission)": {
    ar: 'الدرس 3: الحلقات التكرارية (مهمة اليوم)',
    en: "Lesson 3: Loops & Iterations (Today's Mission)"
  },
  'Mastering while loops, for loops, nested iterations, and break/continue statements.': {
    ar: 'إتقان حلقات while وfor والتكرار المتداخل وجمل break وcontinue.',
    en: 'Mastering while loops, for loops, nested iterations, and break/continue statements.'
  },

  // Tasks
  'Task 1: Print Numbers 1 to 100 with Conditions': {
    ar: 'المهمة 1: طباعة الأرقام من 1 إلى 100 مع الشروط',
    en: 'Task 1: Print Numbers 1 to 100 with Conditions'
  },
  'Write a loop that prints 1 to 100, substituting multiples of 3 with "Fizz" and 5 with "Buzz".': {
    ar: 'اكتب حلقة تكرارية تطبع الأرقام من 1 إلى 100 مع استبدال مضاعفات 3 بـ "Fizz" ومضاعفات 5 بـ "Buzz".',
    en: 'Write a loop that prints 1 to 100, substituting multiples of 3 with "Fizz" and 5 with "Buzz".'
  },
  'Challenge: Number Guessing Game': {
    ar: 'تحدي: لعبة تخمين الرقم',
    en: 'Challenge: Number Guessing Game'
  },
  'Build a CLI game where the computer generates a random number between 1 and 50 and gives clues.': {
    ar: 'قم ببناء لعبة تفاعلية يقوم فيها الحاسوب بتوليد رقم عشوائي بين 1 و50 مع إعطاء تلميحات.',
    en: 'Build a CLI game where the computer generates a random number between 1 and 50 and gives clues.'
  },
  'Submit either your source code text or a GitHub repository link.': {
    ar: 'أرسل إما نص الكود البرمجي الخاص بك أو رابط مستودع GitHub.',
    en: 'Submit either your source code text or a GitHub repository link.'
  },
  'Submit your solution script and write instructions for playing.': {
    ar: 'أرسل كود الحل واكتب تعليمات تشغيل اللعبة.',
    en: 'Submit your solution script and write instructions for playing.'
  },

  // Exams
  'August Programming Fundamentals Exam': {
    ar: 'اختبار شهر أغسطس: أساسيات البرمجة',
    en: 'August Programming Fundamentals Exam'
  },
  'Monthly assessment covering Lesson 1 (Variables) and Lesson 2 (Conditionals).': {
    ar: 'تقييم شهري شامل يغطي الدرس الأول (المتغيرات) والدرس الثاني (الجمل الشرطية).',
    en: 'Monthly assessment covering Lesson 1 (Variables) and Lesson 2 (Conditionals).'
  },
  'Monthly official examinations covering curriculum modules, coding theory, and algorithmic problem solving.': {
    ar: 'امتحانات رسمية شهرية تغطي وحدات المنهج، والنظريات البرمجية، وحل المسائل الخوارزمية.',
    en: 'Monthly official examinations covering curriculum modules, coding theory, and algorithmic problem solving.'
  },

  // Groups
  'Group A': { ar: 'المجموعة أ', en: 'Group A' },
  'Group B': { ar: 'المجموعة ب', en: 'Group B' },
  'Group C': { ar: 'المجموعة ج', en: 'Group C' },
  'Saturday Group (Egyptian Baccalaureate Grade 10/11)': {
    ar: 'مجموعة السبت (البكالوريا المصرية الصف 10/11)',
    en: 'Saturday Group (Egyptian Baccalaureate Grade 10/11)'
  },
  'Sunday Group (Egyptian Baccalaureate Grade 10/11)': {
    ar: 'مجموعة الأحد (البكالوريا المصرية الصف 10/11)',
    en: 'Sunday Group (Egyptian Baccalaureate Grade 10/11)'
  },
  'Monday Group (Advanced Algorithms Track)': {
    ar: 'مجموعة الاثنين (مسار الخوارزميات المتقدمة)',
    en: 'Monday Group (Advanced Algorithms Track)'
  },
  'Saturday 5:00 PM - 7:00 PM': { ar: 'السبت 5:00 م - 7:00 م', en: 'Saturday 5:00 PM - 7:00 PM' },
  'Sunday 6:00 PM - 8:00 PM': { ar: 'الأحد 6:00 م - 8:00 م', en: 'Sunday 6:00 PM - 8:00 PM' },
  'Monday 5:00 PM - 7:00 PM': { ar: 'الاثنين 5:00 م - 7:00 م', en: 'Monday 5:00 PM - 7:00 PM' },

  // Achievements
  '7-Day Consistency Flame': { ar: 'شعلة الالتزام (7 أيام متتالية)', en: '7-Day Consistency Flame' },
  'Maintained a 7-day attendance and homework streak': {
    ar: 'المحافظة على سلسلة حضور وحل الواجبات لمدة 7 أيام متتالية',
    en: 'Maintained a 7-day attendance and homework streak'
  },
  'Exam Master: 100% Score': { ar: 'بطل الامتحانات: الدرجة النهائية 100%', en: 'Exam Master: 100% Score' },
  'Scored full marks on an official monthly assessment': {
    ar: 'تحقيق الدرجة النهائية الكاملة في تقييم شهري رسمي',
    en: 'Scored full marks on an official monthly assessment'
  },
  'Problem Solver Star': { ar: 'نجم حل المشكلات البرمجية', en: 'Problem Solver Star' },
  'Solved 10 algorithm and logic challenges': {
    ar: 'حل 10 تحديات خوارزمية ومنطقية بنجاح',
    en: 'Solved 10 algorithm and logic challenges'
  },
  'First Code Submission': { ar: 'أول إرسال للكود البرمجي', en: 'First Code Submission' },
  'Submitted your very first homework solution': {
    ar: 'إرسال أول حل واجب برمجي للمراجعة والاعتماد',
    en: 'Submitted your very first homework solution'
  }
};

import { formatTime12h, formatScheduleText, formatScheduleDisplay, formatScheduleFromList } from './schedule-helpers.js';

export { formatTime12h, formatScheduleText, formatScheduleDisplay, formatScheduleFromList };

/**
 * Localizes any text string using known database/seed entries or converts dynamic schedule strings to 12h format.
 */
export function localizeText(text: string | null | undefined): string {
  if (!text) return '';
  const currentLang = i18n.language === 'ar' ? 'ar' : 'en';
  const isAr = currentLang === 'ar';
  const trimmed = text.trim();
  const match = KNOWN_TRANSLATIONS[trimmed];
  if (match) {
    return match[currentLang];
  }

  // Check if text contains day names or time patterns like 16:00-17:30
  if (
    /\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|السبت|الأحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)\b/i.test(trimmed) ||
    /\b\d{1,2}:\d{2}\b/.test(trimmed)
  ) {
    return formatScheduleText(trimmed, isAr);
  }

  return text;
}

/**
 * Localizes any backend Enum status value.
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return '';
  const isAr = i18n.language === 'ar';

  const statusMap: Record<string, { ar: string; en: string }> = {
    // Attendance
    PRESENT: { ar: 'حاضر', en: 'Present' },
    ABSENT: { ar: 'غائب', en: 'Absent' },
    LATE: { ar: 'متأخر', en: 'Late' },
    EXCUSED: { ar: 'معذور', en: 'Excused' },

    // Submissions & Registrations
    PENDING: { ar: 'قيد المراجعة', en: 'Pending Review' },
    UNDER_REVIEW: { ar: 'قيد التدقيق', en: 'Under Review' },
    APPROVED: { ar: 'مقبول', en: 'Approved' },
    NEEDS_REVISION: { ar: 'يحتاج تعديل', en: 'Needs Revision' },
    REJECTED: { ar: 'مرفوض', en: 'Rejected' },
    WAITLISTED: { ar: 'قائمة الانتظار', en: 'Waitlisted' },
    EXPIRED: { ar: 'منتهي الصلاحية', en: 'Expired' },
    ARCHIVED: { ar: 'مؤرشف', en: 'Archived' },

    // Payments
    PAID: { ar: 'تم السداد', en: 'Paid' },
    UNPAID: { ar: 'غير مسدد', en: 'Unpaid' },
    OVERDUE: { ar: 'متأخر', en: 'Overdue' },
    PARTIAL: { ar: 'سداد جزئي', en: 'Partial' },

    // Sessions & Exams
    SCHEDULED: { ar: 'مجدولة', en: 'Scheduled' },
    ACTIVE: { ar: 'نشط حالياً', en: 'Active' },
    COMPLETED: { ar: 'مكتمل', en: 'Completed' },
    CANCELLED: { ar: 'ملغي', en: 'Cancelled' },

    // Difficulty
    BEGINNER: { ar: 'مبتدئ', en: 'Beginner' },
    INTERMEDIATE: { ar: 'متوسط', en: 'Intermediate' },
    ADVANCED: { ar: 'متقدم', en: 'Advanced' },

    // Relationships
    FATHER: { ar: 'الأب', en: 'Father' },
    MOTHER: { ar: 'الأم', en: 'Mother' },
    GUARDIAN: { ar: 'ولي الأمر', en: 'Guardian' },
    OTHER: { ar: 'آخر', en: 'Other' },

    // Roles
    STUDENT: { ar: 'طالب', en: 'Student' },
    PARENT: { ar: 'ولي أمر', en: 'Parent' },
    ADMIN: { ar: 'مسؤول', en: 'Admin' },

    // Tasks & Questions
    DAILY_TASK: { ar: 'واجب يومي', en: 'Daily Task' },
    DAILY_HOMEWORK: { ar: 'واجب يومي', en: 'Daily Homework' },
    CHALLENGE: { ar: 'تحدي', en: 'Challenge' },
    PROJECT: { ar: 'مشروع', en: 'Project' },
    WEEKLY_CHALLENGE: { ar: 'تحدي أسبوعي', en: 'Weekly Challenge' },
    CAPSTONE_PROJECT: { ar: 'مشروع تخرج', en: 'Capstone Project' },
    MULTIPLE_CHOICE: { ar: 'اختيار من متعدد', en: 'Multiple Choice' },
    CODE_SNIPPET: { ar: 'كتابة كود برمجي', en: 'Code Snippet' },
    BOOLEAN: { ar: 'صح أو خطأ', en: 'True / False' },
    SHORT_ANSWER: { ar: 'إجابة قصيرة', en: 'Short Answer' },
    OFFICIAL_EB: { ar: 'البكالوريا المصرية', en: 'Official EB' }
  };

  const key = status.toUpperCase().trim();
  if (statusMap[key]) {
    return isAr ? statusMap[key].ar : statusMap[key].en;
  }
  return status;
}

/**
 * Formats duration in minutes (e.g., "45 دقيقة" / "45 mins").
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  const isAr = i18n.language === 'ar';
  return isAr ? `${minutes} دقيقة` : `${minutes} mins`;
}

/**
 * Formats Marks / Points (e.g., "100 درجة" / "100 Marks").
 */
export function formatMarks(marks: number | null | undefined): string {
  if (marks == null) return '';
  const isAr = i18n.language === 'ar';
  return isAr ? `${marks} درجة` : `${marks} Marks`;
}

/**
 * Formats XP (e.g., "+30 XP" / "+30 نقاط خبرة").
 */
export function formatXp(xp: number | null | undefined): string {
  if (xp == null) return '';
  const isAr = i18n.language === 'ar';
  return isAr ? `+${xp} نقطة خبرة` : `+${xp} XP`;
}

/**
 * Formats Streak (e.g., "5 أيام" / "5d").
 */
export function formatStreak(days: number | null | undefined): string {
  if (days == null) return '';
  const isAr = i18n.language === 'ar';
  return isAr ? `${days} أيام` : `${days}d`;
}

/**
 * Formats Currency in EGP (e.g., "250 ج.م" / "250 EGP").
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '';
  const isAr = i18n.language === 'ar';
  return isAr ? `${amount.toLocaleString('ar-EG')} ج.م` : `${amount.toLocaleString('en-US')} EGP`;
}

/**
 * Formats Date using current active locale (e.g. ar-EG).
 */
export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const isAr = i18n.language === 'ar';
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', options || { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Formats Time.
 */
export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const isAr = i18n.language === 'ar';
  if (timeStr.includes(':')) {
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const period = h >= 12 ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM');
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
  }
  return timeStr;
}
