import { prisma } from '../../db/prisma.js';
import { CreateGroupInput, ListGroupsQuery, UpdateGroupInput } from './group.schema.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import { Role } from '@prisma/client';

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function generateScheduleInfo(schedules: { dayOfWeek: number; startTime: string; endTime: string }[]): string | undefined {
  if (!schedules || schedules.length === 0) return undefined;
  const sorted = [...schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return sorted.map((s) => `${DAY_NAMES_EN[s.dayOfWeek]} ${s.startTime}-${s.endTime}`).join(', ');
}

export async function createGroup(input: CreateGroupInput, actorUserId?: string) {
  const existing = await prisma.group.findUnique({
    where: { name: input.name }
  });

  if (existing) {
    throw new BadRequestError(`Group with name "${input.name}" already exists`);
  }

  if (input.schedules && input.schedules.length > 0) {
    const days = input.schedules.map((s) => s.dayOfWeek);
    if (new Set(days).size !== days.length) {
      throw new BadRequestError('Duplicate day of week in group schedule payload');
    }
  }

  const computedScheduleInfo = input.schedules && input.schedules.length > 0
    ? generateScheduleInfo(input.schedules)
    : input.scheduleInfo;

  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      scheduleInfo: computedScheduleInfo,
      whatsappGroupUrl: input.whatsappGroupUrl || null,
      maxCapacity: input.maxCapacity,
      isActive: input.isActive,
      schedules: input.schedules && input.schedules.length > 0
        ? {
            create: input.schedules.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              isActive: s.isActive ?? true
            }))
          }
        : undefined
    },
    include: {
      schedules: {
        orderBy: { dayOfWeek: 'asc' }
      }
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'GROUP_CREATED',
    entityType: 'Group',
    entityId: group.id,
    metadata: { name: group.name }
  });

  return group;
}

export async function listGroups(query: ListGroupsQuery) {
  const where = query.activeOnly ? { isActive: true } : {};

  return prisma.group.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      schedules: {
        where: { isActive: true },
        orderBy: { dayOfWeek: 'asc' }
      },
      _count: {
        select: {
          enrollments: { where: { isActive: true } },
          sessions: true
        }
      }
    }
  });
}

export async function getGroupById(groupId: string, user: { userId: string; role: Role; studentId?: string }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      schedules: {
        orderBy: { dayOfWeek: 'asc' }
      },
      enrollments: {
        where: { isActive: true },
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  avatarUrl: true
                }
              },
              achievements: {
                include: {
                  achievement: true
                }
              }
            }
          }
        }
      },
      sessions: {
        orderBy: { sessionNumber: 'desc' },
        take: 5
      }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // If Admin, return full details
  if (user.role === Role.ADMIN) {
    return group;
  }

  // If Student, verify enrollment in this group
  if (user.role === Role.STUDENT) {
    const isEnrolled = group.enrollments.some((e: any) => e.studentId === user.studentId);
    if (!isEnrolled) {
      throw new ForbiddenError('You can only view groups you are actively enrolled in');
    }

    // Return sanitized classmate peer view (Privacy strictly protected)
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      scheduleInfo: group.scheduleInfo,
      schedules: group.schedules,
      whatsappGroupUrl: group.whatsappGroupUrl,
      maxCapacity: group.maxCapacity,
      members: group.enrollments.map((e: any) => {
        const s = e.student;
        const u = s.user;
        const lastInitial = u.lastName ? ` ${u.lastName.charAt(0)}.` : '';
        return {
          studentId: s.id,
          displayName: `${u.firstName}${lastInitial}`.trim(),
          avatarUrl: u.avatarUrl,
          achievements: s.achievements.map((sa: any) => ({
            id: sa.achievement.id,
            name: sa.achievement.name,
            icon: sa.achievement.icon
          }))
        };
      })
    };
  }

  throw new ForbiddenError('Access denied');
}

export async function updateGroup(groupId: string, input: UpdateGroupInput, actorUserId?: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new NotFoundError('Group not found');
  }

  if (input.schedules && input.schedules.length > 0) {
    const days = input.schedules.map((s) => s.dayOfWeek);
    if (new Set(days).size !== days.length) {
      throw new BadRequestError('Duplicate day of week in group schedule payload');
    }
  }

  let updatedScheduleInfo = input.scheduleInfo !== undefined ? input.scheduleInfo : undefined;

  return prisma.$transaction(async (tx) => {
    if (input.schedules !== undefined) {
      updatedScheduleInfo = generateScheduleInfo(input.schedules) ?? (input.scheduleInfo || null);

      await tx.groupSchedule.deleteMany({
        where: { groupId }
      });

      if (input.schedules.length > 0) {
        await tx.groupSchedule.createMany({
          data: input.schedules.map((s) => ({
            groupId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive ?? true
          }))
        });
      }
    }

    const updated = await tx.group.update({
      where: { id: groupId },
      data: {
        name: input.name,
        description: input.description !== undefined ? input.description : undefined,
        scheduleInfo: updatedScheduleInfo,
        whatsappGroupUrl: input.whatsappGroupUrl !== undefined ? (input.whatsappGroupUrl || null) : undefined,
        maxCapacity: input.maxCapacity,
        isActive: input.isActive
      },
      include: {
        schedules: {
          orderBy: { dayOfWeek: 'asc' }
        }
      }
    });

    await createAuditLog({
      actorUserId,
      action: 'GROUP_UPDATED',
      entityType: 'Group',
      entityId: groupId,
      metadata: { changed: input }
    });

    return updated;
  });
}

export async function enrollStudentInGroup(groupId: string, studentId: string, actorUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { enrollments: { where: { isActive: true } } }
        }
      }
    });
    const student = await tx.student.findUnique({ where: { id: studentId } });

    if (!group) throw new NotFoundError('Group not found');
    if (!student) throw new NotFoundError('Student not found');

    if (group._count.enrollments >= group.maxCapacity) {
      throw new BadRequestError(`Group capacity limit (${group.maxCapacity}) reached`);
    }

    // End any other active enrollment for this student
    await tx.groupEnrollment.updateMany({
      where: { studentId, isActive: true },
      data: { isActive: false, endedAt: new Date() }
    });

    const enrollment = await tx.groupEnrollment.create({
      data: {
        groupId,
        studentId,
        isActive: true
      }
    });

    await createAuditLog({
      actorUserId,
      action: 'STUDENT_ADDED_TO_GROUP',
      entityType: 'GroupEnrollment',
      entityId: enrollment.id,
      metadata: { groupId, studentId }
    });

    return enrollment;
  });
}

export async function removeStudentFromGroup(groupId: string, studentId: string, actorUserId?: string) {
  const enrollment = await prisma.groupEnrollment.findFirst({
    where: { groupId, studentId, isActive: true }
  });

  if (!enrollment) {
    throw new NotFoundError('Active enrollment not found');
  }

  const updated = await prisma.groupEnrollment.update({
    where: { id: enrollment.id },
    data: {
      isActive: false,
      endedAt: new Date()
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'STUDENT_REMOVED_FROM_GROUP',
    entityType: 'GroupEnrollment',
    entityId: enrollment.id,
    metadata: { groupId, studentId }
  });

  return updated;
}

export async function deleteGroup(groupId: string, actorUserId?: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      _count: {
        select: {
          sessions: true,
          enrollments: { where: { isActive: true } }
        }
      }
    }
  });
  if (!group) throw new NotFoundError('Group not found');

  if (group._count.sessions > 0) {
    throw new BadRequestError('Cannot delete group with existing class sessions and historical attendance. Deactivate or archive the group instead.');
  }

  if (group._count.enrollments > 0) {
    throw new BadRequestError('Cannot delete group with actively enrolled students. Remove student enrollments first or deactivate the group.');
  }

  await prisma.group.delete({ where: { id: groupId } });

  await createAuditLog({
    actorUserId,
    action: 'GROUP_DELETED',
    entityType: 'Group',
    entityId: groupId,
    metadata: { name: group.name }
  });

  return { success: true };
}
