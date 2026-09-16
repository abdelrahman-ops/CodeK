import { LessonAccessType, Role } from '@prisma/client';
import { getLessonAccess } from '../access/access.service.js';

export interface LessonAccessResult {
  canAccess: boolean;
  isFreePreview: boolean;
  reason?: 'ATTENDANCE_REQUIRED' | 'SUBSCRIPTION_REQUIRED' | 'PAYMENT_REQUIRED' | 'NOT_ENROLLED' | 'ADMIN_GRANTED' | 'ENROLLED' | null;
  messageAr?: string;
  messageEn?: string;
}

export const LOCKED_EXPLANATION_AR = 'هذا الدرس متاح ضمن المحتوى الكامل';
export const LOCKED_EXPLANATION_EN = 'This lesson is available in the full course content';

/**
 * Centralized authorization adapter delegating to getLessonAccess.
 * Preserves complete backwards compatibility for existing lesson and video controllers.
 */
export async function canAccessLesson(
  user: { userId: string; role: Role; studentId?: string },
  lesson: {
    id: string;
    isFree: boolean;
    accessType: LessonAccessType;
    sessionLessons?: { sessionId: string }[];
  }
): Promise<LessonAccessResult> {
  const decision = await getLessonAccess(user.studentId || null, lesson, {
    userId: user.userId,
    role: user.role
  });

  return {
    canAccess: decision.allowed,
    isFreePreview: decision.isFreePreview,
    reason: decision.allowed ? null : (decision.reason as any),
    messageAr: decision.lockMessageAr || LOCKED_EXPLANATION_AR,
    messageEn: decision.lockMessageEn || LOCKED_EXPLANATION_EN
  };
}
