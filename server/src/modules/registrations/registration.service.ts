import { prisma } from '../../db/prisma.js';
import {
  CreatePublicRegistrationInput,
  UpdateRegistrationInput,
  ApproveRegistrationInput,
  UpdateRegistrationSettingsInput
} from './registration.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { RegistrationStatus, Role } from '@prisma/client';
import { normalizeEgyptianPhone } from '../../utils/phone.js';
import { generateWhatsAppOnboardingMessage } from '../../utils/whatsapp.js';
import {
  generateAnonymousCode,
  generateRegistrationCode,
  generateStudentCode
} from '../../common/utils/code-gen.js';
import { generateTempPassword, hashPassword } from '../../common/utils/crypto.js';
import { createAuditLog } from '../audit/audit.service.js';

export async function getPublicRegistrationStatus() {
  const setting = await prisma.registrationSetting.findUnique({
    where: { id: 'default' }
  });

  const isOpenSetting = setting ? setting.isOpen : true;
  const startDate = setting?.startDate || null;
  const endDate = setting?.endDate || null;
  const maxRegistrations = setting?.maxRegistrations || null;

  const currentCount = await prisma.studentRegistration.count({
    where: {
      status: {
        in: [RegistrationStatus.PENDING, RegistrationStatus.UNDER_REVIEW, RegistrationStatus.APPROVED]
      }
    }
  });

  const now = new Date();
  let isClosed = !isOpenSetting;
  let closedReason: string | null = null;

  if (isClosed) {
    closedReason = 'Registration is currently closed by administration.';
  } else if (startDate && now < startDate) {
    isClosed = true;
    closedReason = 'Registration has not opened yet.';
  } else if (endDate && now > endDate) {
    isClosed = true;
    closedReason = 'Registration period has expired.';
  } else if (maxRegistrations && currentCount >= maxRegistrations) {
    isClosed = true;
    closedReason = 'Registration is currently full.';
  }

  let activeGroups = await prisma.group.findMany({
    where: { isActive: true },
    include: {
      schedules: {
        where: { isActive: true },
        orderBy: { dayOfWeek: 'asc' }
      },
      _count: {
        select: { enrollments: { where: { isActive: true } } }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Seed default groups if none exist in DB
  if (activeGroups.length === 0) {
    try {
      await prisma.group.create({
        data: {
          name: 'المجموعة (أ) - السبت والإثنين والأربعاء',
          description: 'مجموعة المبتدئين - المواعيد المبكرة',
          maxCapacity: 15,
          scheduleInfo: 'Saturday, Monday, Wednesday 4:00 PM - 5:30 PM',
          schedules: {
            create: [
              { dayOfWeek: 6, startTime: '16:00', endTime: '17:30' },
              { dayOfWeek: 1, startTime: '16:00', endTime: '17:30' },
              { dayOfWeek: 3, startTime: '16:00', endTime: '17:30' }
            ]
          }
        }
      });
      await prisma.group.create({
        data: {
          name: 'المجموعة (ب) - الأحد والثلاثاء',
          description: 'مجموعة الأساسيات - مواعيد المساء',
          maxCapacity: 15,
          scheduleInfo: 'Sunday, Tuesday 5:00 PM - 6:30 PM',
          schedules: {
            create: [
              { dayOfWeek: 0, startTime: '17:00', endTime: '18:30' },
              { dayOfWeek: 2, startTime: '17:00', endTime: '18:30' }
            ]
          }
        }
      });
      await prisma.group.create({
        data: {
          name: 'المجموعة (ج) - السبت والخميس',
          description: 'مجموعة نهاية الأسبوع',
          maxCapacity: 15,
          scheduleInfo: 'Saturday, Thursday 6:00 PM - 7:30 PM',
          schedules: {
            create: [
              { dayOfWeek: 6, startTime: '18:00', endTime: '19:30' },
              { dayOfWeek: 4, startTime: '18:00', endTime: '19:30' }
            ]
          }
        }
      });

      activeGroups = await prisma.group.findMany({
        where: { isActive: true },
        include: {
          schedules: {
            where: { isActive: true },
            orderBy: { dayOfWeek: 'asc' }
          },
          _count: {
            select: { enrollments: { where: { isActive: true } } }
          }
        },
        orderBy: { name: 'asc' }
      });
    } catch (e) {
      console.error('Failed to auto-seed groups:', e);
    }
  }

  const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function formatTime12h(timeStr: string, isArabic = false): string {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return timeStr;
    const isPM = h >= 12;
    h = h % 12;
    if (h === 0) h = 12;
    return isArabic ? `${h}:${m} ${isPM ? 'م' : 'ص'}` : `${h}:${m} ${isPM ? 'PM' : 'AM'}`;
  }

  const groups = activeGroups.map((g) => {
    const scheduleSummaryAr = g.schedules.length > 0
      ? g.schedules.map(s => `${dayNamesAr[s.dayOfWeek]} (${formatTime12h(s.startTime, true)} - ${formatTime12h(s.endTime, true)})`).join(' ، ')
      : g.scheduleInfo || 'لم يحدد بعد';
    const scheduleSummaryEn = g.schedules.length > 0
      ? g.schedules.map(s => `${dayNamesEn[s.dayOfWeek]} (${formatTime12h(s.startTime, false)} - ${formatTime12h(s.endTime, false)})`).join(', ')
      : g.scheduleInfo || 'TBD';

    return {
      id: g.id,
      name: g.name,
      description: g.description,
      scheduleInfo: g.scheduleInfo,
      scheduleSummaryAr,
      scheduleSummaryEn,
      schedules: g.schedules.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime
      })),
      maxCapacity: g.maxCapacity,
      enrolledCount: g._count.enrollments,
      isFull: g._count.enrollments >= g.maxCapacity
    };
  });

  return {
    isOpen: !isClosed,
    closedReason,
    startDate,
    endDate,
    maxRegistrations,
    currentRegistrationsCount: currentCount,
    remainingCapacity: maxRegistrations ? Math.max(0, maxRegistrations - currentCount) : null,
    groups
  };
}

export async function createPublicRegistration(input: CreatePublicRegistrationInput, clientIp?: string) {
  // Anti-spam: Honeypot check
  if (input.website && input.website.trim() !== '') {
    throw new BadRequestError('Invalid registration submission');
  }

  // Anti-spam: Form submission timing check
  if (input.formLoadedAt && Date.now() - input.formLoadedAt < 1200) {
    throw new BadRequestError('Submission too rapid, please try again.');
  }

  // Enforcement: Check registration window & capacity
  const statusCheck = await getPublicRegistrationStatus();
  if (!statusCheck.isOpen) {
    throw new BadRequestError(statusCheck.closedReason || 'Registration is currently closed');
  }

  // Phone Normalization
  const normalizedPhone = normalizeEgyptianPhone(input.phone);
  const normalizedWhatsapp = input.whatsappPhone ? normalizeEgyptianPhone(input.whatsappPhone) : normalizedPhone;

  // Duplicate Check: Same active phone number
  const existing = await prisma.studentRegistration.findFirst({
    where: {
      OR: [
        { phone: normalizedPhone },
        { phone: input.phone },
        { whatsappPhone: normalizedWhatsapp }
      ],
      status: {
        notIn: [RegistrationStatus.REJECTED, RegistrationStatus.ARCHIVED]
      }
    }
  });

  if (existing) {
    throw new BadRequestError('A registration using this phone number already exists.');
  }

  // Generate unique REG-XXXXX code
  let registrationCode = generateRegistrationCode();
  while (await prisma.studentRegistration.findUnique({ where: { registrationCode } })) {
    registrationCode = generateRegistrationCode();
  }

  let preferredDays = input.preferredDays ? input.preferredDays.trim() : null;
  let preferredTimes = input.preferredTimes ? input.preferredTimes.trim() : null;
  let preferredGroupId = input.preferredGroupId || null;

  if (preferredGroupId) {
    const prefGroup = await prisma.group.findUnique({
      where: { id: preferredGroupId },
      include: { schedules: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } } }
    });
    if (prefGroup) {
      const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      if (!preferredDays) {
        preferredDays = prefGroup.schedules.length > 0
          ? `${prefGroup.name} (${prefGroup.schedules.map(s => dayNamesAr[s.dayOfWeek]).join(', ')})`
          : prefGroup.name;
      }
      if (!preferredTimes) {
        preferredTimes = prefGroup.schedules.length > 0
          ? prefGroup.schedules.map(s => `${formatTime12h(s.startTime, false)} - ${formatTime12h(s.endTime, false)}`).join(', ')
          : prefGroup.scheduleInfo;
      }
    }
  }

  const registration = await prisma.studentRegistration.create({
    data: {
      registrationCode,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: normalizedPhone,
      whatsappPhone: normalizedWhatsapp,
      email: input.email && input.email.trim() !== '' ? input.email.trim().toLowerCase() : null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      schoolName: input.schoolName ? input.schoolName.trim() : null,
      grade: input.grade ? input.grade.trim() : null,
      programmingLevel: input.programmingLevel,
      previousExperience: input.previousExperience ? input.previousExperience.trim() : null,
      motivation: input.motivation ? input.motivation.trim() : null,
      preferredGroupId,
      preferredDays,
      preferredTimes,
      parentName: input.parentName ? input.parentName.trim() : null,
      parentPhone: input.parentPhone ? normalizeEgyptianPhone(input.parentPhone) : null,
      parentRelationship: input.parentRelationship || null,
      status: RegistrationStatus.PENDING,
      clientIp: clientIp || null
    }
  });

  // Notify Admins
  const adminUsers = await prisma.user.findMany({ where: { role: Role.ADMIN } });
  if (adminUsers.length > 0) {
    await prisma.notification.createMany({
      data: adminUsers.map((admin) => ({
        userId: admin.id,
        title: 'New Student Registration',
        message: `${registration.firstName} ${registration.lastName} submitted a new registration form (${registration.registrationCode}).`
      }))
    });
  }

  await createAuditLog({
    action: 'REGISTRATION_CREATED',
    entityType: 'StudentRegistration',
    entityId: registration.id,
    metadata: { registrationCode: registration.registrationCode, phone: registration.phone }
  });

  return registration;
}

export async function listAdminRegistrations(query: {
  search?: string;
  status?: RegistrationStatus;
  page?: number;
  limit?: number;
}) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' as const } },
            { lastName: { contains: query.search, mode: 'insensitive' as const } },
            { registrationCode: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
            { schoolName: { contains: query.search, mode: 'insensitive' as const } }
          ]
        }
      : {})
  };

  const [total, items, statusCountsGroup] = await Promise.all([
    prisma.studentRegistration.count({ where }),
    prisma.studentRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        reviewedByUser: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdStudent: {
          select: { id: true, studentCode: true, user: { select: { loginId: true } } }
        }
      }
    }),
    prisma.studentRegistration.groupBy({
      by: ['status'],
      _count: { _all: true }
    })
  ]);

  const counts: Record<string, number> = {
    ALL: 0,
    PENDING: 0,
    UNDER_REVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
    WAITLISTED: 0,
    EXPIRED: 0,
    ARCHIVED: 0
  };

  for (const group of statusCountsGroup) {
    counts[group.status] = group._count._all;
    counts.ALL += group._count._all;
  }

  const settings = await prisma.registrationSetting.findUnique({ where: { id: 'default' } });

  return {
    items,
    counts,
    settings,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function getAdminRegistrationById(id: string) {
  const registration = await prisma.studentRegistration.findUnique({
    where: { id },
    include: {
      preferredGroup: {
        select: { id: true, name: true, scheduleInfo: true }
      },
      reviewedByUser: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      createdStudent: {
        include: {
          user: {
            select: { id: true, loginId: true, phone: true }
          },
          enrollments: {
            where: { isActive: true },
            include: { group: true }
          }
        }
      }
    }
  });

  if (!registration) {
    throw new NotFoundError('Student registration not found');
  }

  return registration;
}

export async function updateAdminRegistration(
  id: string,
  input: UpdateRegistrationInput,
  actorUserId?: string
) {
  const existing = await prisma.studentRegistration.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Student registration not found');
  }

  const updated = await prisma.studentRegistration.update({
    where: { id },
    data: {
      ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
      ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
      ...(input.status ? { status: input.status, reviewedAt: new Date(), reviewedByUserId: actorUserId } : {})
    }
  });

  if (actorUserId) {
    await createAuditLog({
      actorUserId,
      action: `REGISTRATION_${input.status || 'UPDATED'}`,
      entityType: 'StudentRegistration',
      entityId: updated.id,
      metadata: { status: updated.status }
    });
  }

  return updated;
}

export async function approveRegistrationAndCreateStudent(
  id: string,
  input: ApproveRegistrationInput,
  actorUserId: string
) {
  const reg = await prisma.studentRegistration.findUnique({ where: { id } });
  if (!reg) {
    throw new NotFoundError('Student registration not found');
  }

  if (reg.status === RegistrationStatus.APPROVED && reg.createdStudentId) {
    throw new BadRequestError('Registration is already approved and student account created.');
  }

  let loginId = generateStudentCode();
  while (await prisma.user.findUnique({ where: { loginId } })) {
    loginId = generateStudentCode();
  }

  let anonymousCode = generateAnonymousCode();
  while (await prisma.student.findFirst({ where: { anonymousLeaderboardCode: anonymousCode } })) {
    anonymousCode = generateAnonymousCode();
  }

  const rawPassword = generateTempPassword(8);
  const passwordHash = await hashPassword(rawPassword);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        loginId,
        passwordHash,
        mustChangePassword: true,
        email: reg.email,
        phone: reg.phone,
        role: Role.STUDENT,
        firstName: reg.firstName,
        lastName: reg.lastName
      }
    });

    // 2. Create Student
    const student = await tx.student.create({
      data: {
        userId: user.id,
        studentCode: loginId,
        anonymousLeaderboardCode: anonymousCode,
        programmingLevel: reg.programmingLevel,
        schoolName: reg.schoolName,
        dateOfBirth: reg.dateOfBirth
      }
    });

    // 3. Optional Group Enrollment
    let assignedGroup = null;
    const targetGroupId = input.groupId || reg.preferredGroupId;
    if (targetGroupId) {
      const group = await tx.group.findUnique({ where: { id: targetGroupId } });
      if (group) {
        assignedGroup = group;
        await tx.groupEnrollment.create({
          data: {
            studentId: student.id,
            groupId: group.id,
            isActive: true
          }
        });
      }
    }

    // 4. Update Registration Status
    const updatedReg = await tx.studentRegistration.update({
      where: { id },
      data: {
        status: RegistrationStatus.APPROVED,
        createdStudentId: student.id,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        adminNotes: input.adminNotes || reg.adminNotes
      }
    });

    return { user, student, updatedReg, assignedGroup };
  });

  // 5. Audit Logs
  await createAuditLog({
    actorUserId,
    action: 'STUDENT_ACCOUNT_CREATED_FROM_REGISTRATION',
    entityType: 'Student',
    entityId: result.student.id,
    metadata: { registrationCode: reg.registrationCode, loginId: result.user.loginId }
  });

  await createAuditLog({
    actorUserId,
    action: 'REGISTRATION_APPROVED',
    entityType: 'StudentRegistration',
    entityId: reg.id,
    metadata: { registrationCode: reg.registrationCode }
  });

  // 6. Generate WhatsApp Onboarding Message
  const whatsappOnboarding = generateWhatsAppOnboardingMessage({
    studentName: `${reg.firstName} ${reg.lastName}`,
    loginId: result.user.loginId,
    tempPassword: rawPassword,
    phone: reg.phone,
    groupName: result.assignedGroup?.name,
    scheduleInfo: result.assignedGroup?.scheduleInfo || undefined,
    whatsappGroupUrl: result.assignedGroup?.whatsappGroupUrl || undefined
  });

  return {
    registration: result.updatedReg,
    user: {
      id: result.user.id,
      loginId: result.user.loginId,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      phone: result.user.phone
    },
    student: {
      id: result.student.id,
      studentCode: result.student.studentCode
    },
    credentials: {
      loginId: result.user.loginId,
      temporaryPassword: rawPassword,
      studentCode: result.student.studentCode
    },
    whatsappOnboarding
  };
}

export async function updateRegistrationSettings(input: UpdateRegistrationSettingsInput) {
  const setting = await prisma.registrationSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      isOpen: input.isOpen ?? true,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      maxRegistrations: input.maxRegistrations ?? null
    },
    update: {
      ...(input.isOpen !== undefined ? { isOpen: input.isOpen } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      ...(input.maxRegistrations !== undefined ? { maxRegistrations: input.maxRegistrations } : {})
    }
  });

  return setting;
}
