import { AccessGrantScope, LessonAccessType, Role, StudentGrade } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import {
  CreateAccessGrantInput,
  RevokeAccessGrantInput,
  ListAccessGrantsQuery,
  CreateSubscriptionPlanInput
} from './access.schema.js';

export type LessonAccessReason =
  | 'FREE_PREVIEW'
  | 'ENROLLED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ADMIN_GRANTED'
  | 'ATTENDANCE_REQUIRED'
  | 'NOT_ENROLLED';

export interface LessonAccessDecision {
  allowed: boolean;
  reason: LessonAccessReason;
  isFreePreview: boolean;
  lesson?: {
    id: string;
    title?: string;
    curriculumId?: string;
    isFree: boolean;
    accessType: LessonAccessType;
  };
  grant?: {
    id: string;
    scope: AccessGrantScope;
    reason: string;
    validUntil: Date | null;
  } | null;
  lockMessageAr?: string | null;
  lockMessageEn?: string | null;
}

export const LOCKED_EXPLANATION_AR = 'هذا الدرس متاح ضمن المحتوى الكامل';
export const LOCKED_EXPLANATION_EN = 'This lesson is available in the full course content';

export interface LessonAccessInputObject {
  id: string;
  title?: string;
  curriculumId?: string;
  isFree: boolean;
  accessType: LessonAccessType;
  sessionLessons?: { sessionId: string }[];
}

/**
 * Authoritative Central Entitlement Engine:
 * "Can this student access this lesson?"
 */
export async function getLessonAccess(
  studentId: string | null | undefined,
  lessonOrId: string | LessonAccessInputObject,
  callerContext?: { userId?: string; role?: Role }
): Promise<LessonAccessDecision> {
  // 1. Admin role has absolute educational access
  if (callerContext?.role === Role.ADMIN) {
    const lessonMeta = typeof lessonOrId === 'string'
      ? { id: lessonOrId, isFree: false, accessType: LessonAccessType.ADMIN_GRANTED }
      : { id: lessonOrId.id, isFree: lessonOrId.isFree, accessType: lessonOrId.accessType };

    return {
      allowed: true,
      reason: 'ADMIN_GRANTED',
      isFreePreview: false,
      lesson: lessonMeta
    };
  }

  // 2. Resolve full lesson from DB if id was given or missing fields
  let lesson: {
    id: string;
    title?: string;
    curriculumId?: string;
    isFree: boolean;
    accessType: LessonAccessType;
    sessionLessons?: { sessionId: string }[];
  };

  if (typeof lessonOrId === 'string') {
    const dbLesson = await prisma.lesson.findUnique({
      where: { id: lessonOrId },
      select: {
        id: true,
        title: true,
        curriculumId: true,
        isFree: true,
        accessType: true,
        sessionLessons: { select: { sessionId: true } }
      }
    });

    if (!dbLesson) {
      throw new NotFoundError('Lesson not found');
    }

    lesson = dbLesson;
  } else {
    lesson = lessonOrId;
  }

  const lessonMeta = {
    id: lesson.id,
    title: lesson.title,
    curriculumId: lesson.curriculumId,
    isFree: lesson.isFree,
    accessType: lesson.accessType
  };

  // 3. Strict Grade Isolation check for students (must precede free preview evaluation)
  if (studentId && lesson.curriculumId) {
    const [student, curriculum] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { grade: true } }),
      prisma.curriculum.findUnique({ where: { id: lesson.curriculumId }, select: { grade: true } })
    ]);

    if (curriculum && student?.grade && curriculum.grade !== student.grade) {
      return {
        allowed: false,
        reason: 'NOT_ENROLLED',
        isFreePreview: false,
        lesson: lessonMeta,
        lockMessageAr: 'هذا المحتوى مخصص لصف دراسي آخر',
        lockMessageEn: 'This content is designated for another grade'
      };
    }
  }

  // 4. Free Preview check on resolved DB lesson
  if (lesson.isFree || lesson.accessType === LessonAccessType.FREE) {
    return {
      allowed: true,
      reason: 'FREE_PREVIEW',
      isFreePreview: true,
      lesson: lessonMeta
    };
  }

  // 5. If no student profile (e.g. unauthenticated or parent)
  if (!studentId) {
    return {
      allowed: false,
      reason: 'SUBSCRIPTION_REQUIRED',
      isFreePreview: false,
      lesson: lessonMeta,
      lockMessageAr: LOCKED_EXPLANATION_AR,
      lockMessageEn: LOCKED_EXPLANATION_EN
    };
  }

  const now = new Date();

  // 6. Explicit Educational Access Grant (Admin Granted)
  const activeGrants = await prisma.educationalAccessGrant.findMany({
    where: {
      studentId,
      isActive: true,
      validFrom: { lte: now },
      OR: [
        { validUntil: null },
        { validUntil: { gte: now } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  const matchingGrant = activeGrants.find((g) => {
    if (g.scope === AccessGrantScope.ALL_ACCESS) return true;
    if (g.scope === AccessGrantScope.COURSE && lesson.curriculumId && g.curriculumId === lesson.curriculumId) return true;
    if (g.scope === AccessGrantScope.LESSON && g.lessonId === lesson.id) return true;
    return false;
  });

  if (matchingGrant) {
    return {
      allowed: true,
      reason: 'ADMIN_GRANTED',
      isFreePreview: false,
      lesson: lessonMeta,
      grant: {
        id: matchingGrant.id,
        scope: matchingGrant.scope,
        reason: matchingGrant.reason,
        validUntil: matchingGrant.validUntil
      }
    };
  }

  // 7. Active Subscription
  const activeSub = await prisma.subscription.findFirst({
    where: {
      studentId,
      status: 'ACTIVE',
      currentPeriodEnd: { gte: now }
    }
  });

  if (activeSub) {
    return {
      allowed: true,
      reason: 'ENROLLED',
      isFreePreview: false,
      lesson: lessonMeta
    };
  }

  // 8. If subscription is required and no active subscription, deny
  if (lesson.accessType === LessonAccessType.SUBSCRIPTION_REQUIRED) {
    return {
      allowed: false,
      reason: 'SUBSCRIPTION_REQUIRED',
      isFreePreview: false,
      lesson: lessonMeta,
      lockMessageAr: LOCKED_EXPLANATION_AR,
      lockMessageEn: LOCKED_EXPLANATION_EN
    };
  }

  // 9. Attendance check for session-linked lessons
  const sessionLessons = lesson.sessionLessons || (typeof lessonOrId === 'object' && (lessonOrId as any).sessionLessons
    ? (lessonOrId as any).sessionLessons
    : await prisma.sessionLesson.findMany({
        where: { lessonId: lesson.id },
        select: { sessionId: true }
      }));

  const sessionIds = (sessionLessons || []).map((sl: any) => sl.sessionId).filter(Boolean);

  if (sessionIds.length > 0) {
    const attendanceRecord = await prisma.attendance.findFirst({
      where: {
        studentId,
        sessionId: { in: sessionIds },
        status: 'PRESENT'
      }
    });

    if (attendanceRecord) {
      return {
        allowed: true,
        reason: 'ENROLLED',
        isFreePreview: false,
        lesson: lessonMeta
      };
    }
  }

  // 10. Denied: Attendance required if lesson demands attendance
  if (lesson.accessType === LessonAccessType.ATTENDANCE_REQUIRED) {
    return {
      allowed: false,
      reason: 'ATTENDANCE_REQUIRED',
      isFreePreview: false,
      lesson: lessonMeta,
      lockMessageAr: LOCKED_EXPLANATION_AR,
      lockMessageEn: LOCKED_EXPLANATION_EN
    };
  }

  // 11. Denied (Subscription Required)
  return {
    allowed: false,
    reason: 'SUBSCRIPTION_REQUIRED',
    isFreePreview: false,
    lesson: lessonMeta,
    lockMessageAr: LOCKED_EXPLANATION_AR,
    lockMessageEn: LOCKED_EXPLANATION_EN
  };
}

/**
 * Grant manual educational access (Admin only)
 */
export async function grantEducationalAccess(
  input: CreateAccessGrantInput,
  adminUserId: string
) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { user: { select: { firstName: true, lastName: true } } }
  });
  if (!student) {
    throw new NotFoundError('Student not found');
  }

  if (input.scope === AccessGrantScope.COURSE) {
    if (!input.curriculumId) {
      throw new BadRequestError('curriculumId is required for COURSE scope');
    }
    const course = await prisma.curriculum.findUnique({ where: { id: input.curriculumId } });
    if (!course) throw new NotFoundError('Course not found');
  }

  if (input.scope === AccessGrantScope.LESSON) {
    if (!input.lessonId) {
      throw new BadRequestError('lessonId is required for LESSON scope');
    }
    const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
    if (!lesson) throw new NotFoundError('Lesson not found');
  }

  const grant = await prisma.educationalAccessGrant.create({
    data: {
      studentId: input.studentId,
      scope: input.scope,
      curriculumId: input.curriculumId || null,
      lessonId: input.lessonId || null,
      grantedByUserId: adminUserId,
      reason: input.reason,
      validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
      validUntil: input.validUntil ? new Date(input.validUntil) : null
    },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      curriculum: { select: { id: true, title: true } },
      lesson: { select: { id: true, title: true } }
    }
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'EDUCATIONAL_ACCESS_GRANTED',
    entityType: 'EducationalAccessGrant',
    entityId: grant.id,
    metadata: {
      studentId: grant.studentId,
      scope: grant.scope,
      reason: grant.reason,
      validUntil: grant.validUntil
    }
  });

  return grant;
}

/**
 * Revoke an active educational access grant (Admin only)
 */
export async function revokeEducationalAccess(
  grantId: string,
  input: RevokeAccessGrantInput,
  adminUserId: string
) {
  const grant = await prisma.educationalAccessGrant.findUnique({
    where: { id: grantId }
  });
  if (!grant) {
    throw new NotFoundError('Educational access grant not found');
  }

  if (!grant.isActive) {
    throw new BadRequestError('This grant has already been revoked');
  }

  const updated = await prisma.educationalAccessGrant.update({
    where: { id: grantId },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedByUserId: adminUserId,
      revokedReason: input.reason || 'Revoked by administrator'
    }
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'EDUCATIONAL_ACCESS_REVOKED',
    entityType: 'EducationalAccessGrant',
    entityId: grantId,
    metadata: {
      studentId: grant.studentId,
      revokedReason: input.reason
    }
  });

  return updated;
}

/**
 * List educational access grants (Admin)
 */
export async function listAccessGrants(query: ListAccessGrantsQuery) {
  const where: any = {
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.scope ? { scope: query.scope } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {})
  };

  return prisma.educationalAccessGrant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, loginId: true } }
        }
      },
      curriculum: { select: { id: true, title: true } },
      lesson: { select: { id: true, title: true } },
      grantedByUser: { select: { id: true, firstName: true, lastName: true } }
    }
  });
}

/**
 * Create or update a Subscription Plan
 */
export async function createSubscriptionPlan(
  input: CreateSubscriptionPlanInput,
  adminUserId?: string
) {
  const existing = await prisma.subscriptionPlan.findUnique({
    where: { code: input.code }
  });

  if (existing) {
    throw new BadRequestError(`Subscription plan with code "${input.code}" already exists`);
  }

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: input.name,
      code: input.code,
      description: input.description,
      price: input.price,
      currency: input.currency,
      billingInterval: input.billingInterval,
      isActive: input.isActive,
      features: input.features || null
    }
  });

  if (adminUserId) {
    await createAuditLog({
      actorUserId: adminUserId,
      action: 'SUBSCRIPTION_PLAN_CREATED',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      metadata: { code: plan.code, price: plan.price }
    });
  }

  return plan;
}

/**
 * List Subscription Plans (supports grade-scoping)
 */
export async function listSubscriptionPlans(onlyActive = true, grade?: StudentGrade) {
  const plans = await prisma.subscriptionPlan.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: { price: 'asc' }
  });

  if (!grade) {
    return plans;
  }

  return plans.filter((p) => {
    const meta = (p.features as any) || {};
    const planGrade =
      meta.grade ||
      (p.code.startsWith('GRADE_1')
        ? StudentGrade.GRADE_1
        : p.code.startsWith('GRADE_2')
        ? StudentGrade.GRADE_2
        : p.code.startsWith('GRADE_3')
        ? StudentGrade.GRADE_3
        : null);
    return planGrade === grade;
  });
}
