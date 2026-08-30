import { prisma } from '../../db/prisma.js';
import {
  generateAdminCode,
  generateAnonymousCode,
  generateParentCode,
  generateStudentCode
} from '../../common/utils/code-gen.js';
import {
  generateRandomToken,
  generateTempPassword,
  hashPassword,
  hashToken
} from '../../common/utils/crypto.js';
import {
  CreateParentUserInput,
  CreateStudentUserInput,
  ListUsersQuery,
  UpdateUserInput
} from './user.schema.js';
import { AuthTokenType, Role } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';

export async function createStudentUser(input: CreateStudentUserInput, actorUserId?: string) {
  let loginId = generateStudentCode();
  // Ensure unique loginId
  while (await prisma.user.findUnique({ where: { loginId } })) {
    loginId = generateStudentCode();
  }

  let anonymousCode = generateAnonymousCode();
  // Ensure unique anonymousLeaderboardCode
  while (await prisma.student.findFirst({ where: { anonymousLeaderboardCode: anonymousCode } })) {
    anonymousCode = generateAnonymousCode();
  }

  const rawPassword = input.customPassword || generateTempPassword(8);
  const passwordHash = await hashPassword(rawPassword);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        loginId,
        passwordHash,
        mustChangePassword: true,
        email: input.email && input.email.trim() !== '' ? input.email.toLowerCase() : null,
        phone: input.phone && input.phone.trim() !== '' ? input.phone : null,
        role: Role.STUDENT,
        firstName: input.firstName,
        lastName: input.lastName
      }
    });

    const student = await tx.student.create({
      data: {
        userId: user.id,
        studentCode: loginId,
        anonymousLeaderboardCode: anonymousCode,
        programmingLevel: input.programmingLevel,
        schoolName: input.schoolName || null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null
      }
    });

    if (input.groupId) {
      await tx.groupEnrollment.create({
        data: {
          studentId: student.id,
          groupId: input.groupId,
          isActive: true
        }
      });
    }

    let groupInfo = null;
    if (input.groupId) {
      groupInfo = await tx.group.findUnique({
        where: { id: input.groupId },
        select: { id: true, name: true, scheduleInfo: true, whatsappGroupUrl: true }
      });
    }

    return { user, student, group: groupInfo };
  });

  await createAuditLog({
    actorUserId,
    action: 'STUDENT_CREATED',
    entityType: 'Student',
    entityId: result.student.id,
    metadata: { loginId, studentId: result.student.id, groupId: input.groupId }
  });

  return {
    user: {
      id: result.user.id,
      loginId: result.user.loginId,
      role: result.user.role,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone
    },
    student: result.student,
    temporaryPassword: rawPassword,
    group: result.group
  };
}

export async function createParentUser(input: CreateParentUserInput, actorUserId?: string) {
  let loginId = generateParentCode();
  while (await prisma.user.findUnique({ where: { loginId } })) {
    loginId = generateParentCode();
  }

  const rawPassword = input.customPassword || generateTempPassword(8);
  const passwordHash = await hashPassword(rawPassword);

  const rawInviteToken = generateRandomToken(32);
  const tokenHash = hashToken(rawInviteToken);

  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 14); // 14 days for onboarding link

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        loginId,
        passwordHash,
        mustChangePassword: true,
        email: input.email && input.email.trim() !== '' ? input.email.toLowerCase() : null,
        phone: input.phone && input.phone.trim() !== '' ? input.phone : null,
        role: Role.PARENT,
        firstName: input.firstName,
        lastName: input.lastName
      }
    });

    const parent = await tx.parent.create({
      data: {
        userId: user.id,
        parentCode: loginId
      }
    });

    if (input.studentIds && input.studentIds.length > 0) {
      for (const studentId of input.studentIds) {
        await tx.parentStudent.create({
          data: {
            parentId: parent.id,
            studentId,
            isPrimary: true
          }
        });
      }
    }

    await tx.authToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: AuthTokenType.PARENT_INVITE,
        expiresAt: inviteExpiresAt
      }
    });

    return { user, parent };
  });

  await createAuditLog({
    actorUserId,
    action: 'PARENT_CREATED',
    entityType: 'Parent',
    entityId: result.parent.id,
    metadata: { loginId, parentId: result.parent.id, linkedStudents: input.studentIds }
  });

  return {
    user: {
      id: result.user.id,
      loginId: result.user.loginId,
      role: result.user.role,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone
    },
    parent: result.parent,
    temporaryPassword: rawPassword,
    inviteToken: rawInviteToken
  };
}

export async function generateOneTimeResetLink(userId: string, actorUserId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 2); // 48h validity

  // Invalidate any existing unused reset tokens for this user
  await prisma.authToken.deleteMany({
    where: {
      userId,
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null
    }
  });

  await prisma.authToken.create({
    data: {
      userId,
      tokenHash,
      type: AuthTokenType.PASSWORD_RESET,
      expiresAt
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'PASSWORD_RESET_LINK_GENERATED',
    entityType: 'User',
    entityId: userId,
    metadata: { loginId: user.loginId }
  });

  return {
    loginId: user.loginId,
    token: rawToken,
    expiresAt
  };
}

export async function generateOneTimeInviteLink(userId: string, actorUserId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14 days validity

  await prisma.authToken.deleteMany({
    where: {
      userId,
      type: AuthTokenType.PARENT_INVITE,
      usedAt: null
    }
  });

  await prisma.authToken.create({
    data: {
      userId,
      tokenHash,
      type: AuthTokenType.PARENT_INVITE,
      expiresAt
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'INVITE_LINK_GENERATED',
    entityType: 'User',
    entityId: userId
  });

  return {
    loginId: user.loginId,
    token: rawToken,
    expiresAt
  };
}

export async function listUsers(query: ListUsersQuery) {
  const { role, search, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { loginId: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } }
          ]
        }
      : {})
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        loginId: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            studentCode: true,
            anonymousLeaderboardCode: true,
            programmingLevel: true,
            totalXp: true,
            currentStreak: true,
            enrollments: {
              where: { isActive: true },
              include: { group: true }
            }
          }
        },
        parent: {
          select: {
            id: true,
            parentCode: true,
            children: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { firstName: true, lastName: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          enrollments: {
            where: { isActive: true },
            include: { group: true }
          },
          parents: {
            include: {
              parent: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true, phone: true }
                  }
                }
              }
            }
          }
        }
      },
      parent: {
        include: {
          children: {
            include: {
              student: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput, actorUserId?: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email !== undefined ? (input.email ? input.email.toLowerCase() : null) : undefined,
      phone: input.phone !== undefined ? input.phone : undefined,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: id,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteUser(id: string, actorUserId?: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.role === Role.ADMIN) {
    throw new BadRequestError('Admin user cannot be deleted');
  }

  await prisma.user.delete({ where: { id } });

  await createAuditLog({
    actorUserId,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: id,
    metadata: { loginId: user.loginId, role: user.role }
  });

  return { success: true };
}
