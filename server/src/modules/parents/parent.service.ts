import { prisma } from '../../db/prisma.js';
import { LinkChildInput, UpdateChildRelationshipInput } from './parent.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';

export async function getMyChildren(parentUserId: string) {
  const parent = await prisma.parent.findUnique({
    where: { userId: parentUserId },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  loginId: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true
                }
              },
              enrollments: {
                where: { isActive: true },
                include: { group: true }
              },
              achievements: {
                include: { achievement: true }
              },
              _count: {
                select: {
                  attendances: { where: { status: 'PRESENT' } },
                  submissions: { where: { status: 'APPROVED' } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!parent) {
    throw new NotFoundError('Parent profile not found');
  }

  return parent.children.map((rel: any) => {
    const s = rel.student;
    const u = s.user;
    return {
      relationshipId: rel.id,
      relationship: rel.relationship,
      isPrimary: rel.isPrimary,
      studentId: s.id,
      studentCode: s.studentCode,
      displayName: `${u.firstName} ${u.lastName}`,
      avatarUrl: u.avatarUrl,
      programmingLevel: s.programmingLevel,
      totalXp: s.totalXp,
      currentStreak: s.currentStreak,
      activeGroup: s.enrollments[0]?.group || null,
      presentAttendanceCount: s._count.attendances,
      approvedSubmissionsCount: s._count.submissions,
      achievements: s.achievements.map((sa: any) => ({
        id: sa.achievement.id,
        name: sa.achievement.name,
        icon: sa.achievement.icon
      }))
    };
  });
}

export async function linkChild(input: LinkChildInput, actorUserId?: string) {
  const [parent, student] = await Promise.all([
    prisma.parent.findUnique({ where: { id: input.parentId } }),
    prisma.student.findUnique({ where: { id: input.studentId } })
  ]);

  if (!parent) throw new NotFoundError('Parent not found');
  if (!student) throw new NotFoundError('Student not found');

  const existing = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: {
        parentId: input.parentId,
        studentId: input.studentId
      }
    }
  });

  // If already linked, update the existing relationship instead of duplicating
  if (existing) {
    const updated = await prisma.parentStudent.update({
      where: { id: existing.id },
      data: {
        relationship: input.relationship,
        isPrimary: input.isPrimary !== undefined ? input.isPrimary : existing.isPrimary
      }
    });

    await createAuditLog({
      actorUserId,
      action: 'PARENT_STUDENT_RELATIONSHIP_UPDATED',
      entityType: 'ParentStudent',
      entityId: updated.id,
      metadata: { parentId: input.parentId, studentId: input.studentId, relationship: input.relationship }
    });

    return updated;
  }

  const link = await prisma.parentStudent.create({
    data: {
      parentId: input.parentId,
      studentId: input.studentId,
      relationship: input.relationship,
      isPrimary: input.isPrimary
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'PARENT_STUDENT_LINKED',
    entityType: 'ParentStudent',
    entityId: link.id,
    metadata: { parentId: input.parentId, studentId: input.studentId, relationship: input.relationship }
  });

  return link;
}

export async function updateChildRelationship(input: UpdateChildRelationshipInput, actorUserId?: string) {
  const link = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: {
        parentId: input.parentId,
        studentId: input.studentId
      }
    }
  });

  if (!link) {
    throw new NotFoundError('Parent-student link not found');
  }

  const updated = await prisma.parentStudent.update({
    where: { id: link.id },
    data: {
      relationship: input.relationship,
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {})
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'PARENT_STUDENT_RELATIONSHIP_UPDATED',
    entityType: 'ParentStudent',
    entityId: updated.id,
    metadata: { parentId: input.parentId, studentId: input.studentId, relationship: input.relationship }
  });

  return updated;
}

export async function unlinkChild(parentId: string, studentId: string, actorUserId?: string) {
  const link = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: {
        parentId,
        studentId
      }
    }
  });

  if (!link) {
    throw new NotFoundError('Parent-student link not found');
  }

  await prisma.parentStudent.delete({
    where: { id: link.id }
  });

  await createAuditLog({
    actorUserId,
    action: 'PARENT_STUDENT_UNLINKED',
    entityType: 'ParentStudent',
    entityId: link.id,
    metadata: { parentId, studentId }
  });

  return { success: true, message: 'Child unlinked successfully' };
}

export async function deleteParent(parentId: string, actorUserId?: string) {
  const parent = await prisma.parent.findUnique({
    where: { id: parentId },
    include: { user: true }
  });

  if (!parent) throw new NotFoundError('Parent not found');

  await prisma.user.delete({
    where: { id: parent.userId }
  });

  await createAuditLog({
    actorUserId,
    action: 'PARENT_DELETED',
    entityType: 'Parent',
    entityId: parentId,
    metadata: { parentCode: parent.parentCode, loginId: parent.user.loginId }
  });

  return { success: true };
}
