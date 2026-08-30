import { prisma } from '../../db/prisma.js';
import {
  AwardAchievementInput,
  CreateAchievementInput,
  LeaderboardQuery,
  ListXpHistoryQuery
} from './gamification.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { LeaderboardStatus, NotificationType, Role, XPSourceType } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { createBulkNotifications, createNotification } from '../notifications/notification.service.js';

export async function createAchievement(input: CreateAchievementInput, actorUserId?: string) {
  const existing = await prisma.achievement.findUnique({
    where: { code: input.code }
  });

  if (existing) {
    throw new BadRequestError(`Achievement with code "${input.code}" already exists`);
  }

  const achievement = await prisma.achievement.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      icon: input.icon,
      xpReward: input.xpReward,
      isActive: input.isActive
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'ACHIEVEMENT_CREATED',
    entityType: 'Achievement',
    entityId: achievement.id,
    metadata: { code: achievement.code, xpReward: achievement.xpReward }
  });

  return achievement;
}

export async function listAchievements(studentId?: string) {
  const achievements = await prisma.achievement.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' }
  });

  if (!studentId) {
    return achievements;
  }

  const unlocked = await prisma.studentAchievement.findMany({
    where: { studentId },
    select: { achievementId: true, unlockedAt: true }
  });

  const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

  return achievements.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    description: a.description,
    icon: a.icon,
    xpReward: a.xpReward,
    isUnlocked: unlockedMap.has(a.id),
    unlockedAt: unlockedMap.get(a.id) || null
  }));
}

export async function awardAchievement(input: AwardAchievementInput, actorUserId?: string) {
  const [student, achievement] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId }, include: { user: true } }),
    prisma.achievement.findUnique({ where: { id: input.achievementId } })
  ]);

  if (!student) throw new NotFoundError('Student not found');
  if (!achievement) throw new NotFoundError('Achievement not found');

  const existing = await prisma.studentAchievement.findUnique({
    where: {
      studentId_achievementId: {
        studentId: input.studentId,
        achievementId: input.achievementId
      }
    }
  });

  if (existing) {
    throw new BadRequestError('Student already has this achievement');
  }

  const result = await prisma.$transaction(async (tx) => {
    const studentAch = await tx.studentAchievement.create({
      data: {
        studentId: input.studentId,
        achievementId: input.achievementId
      }
    });

    if (achievement.xpReward > 0) {
      await tx.xPTransaction.create({
        data: {
          studentId: input.studentId,
          amount: achievement.xpReward,
          reason: `Achievement: ${achievement.name}`,
          sourceType: XPSourceType.ACHIEVEMENT,
          sourceId: achievement.id
        }
      });

      await tx.student.update({
        where: { id: input.studentId },
        data: {
          totalXp: { increment: achievement.xpReward },
          lastActiveDate: new Date()
        }
      });
    }

    return studentAch;
  });

  await createNotification({
    userId: student.userId,
    title: 'Achievement Unlocked',
    message: `You earned the "${achievement.name}" badge (+${achievement.xpReward} XP). ${achievement.description}`,
    type: NotificationType.ACHIEVEMENT_UNLOCKED
  });

  await createAuditLog({
    actorUserId,
    action: 'ACHIEVEMENT_AWARDED',
    entityType: 'StudentAchievement',
    entityId: result.id,
    metadata: { studentId: input.studentId, achievementCode: achievement.code }
  });

  return result;
}

export async function listXpHistory(
  targetStudentId: string,
  query: ListXpHistoryQuery,
  requestUser?: { userId: string; role: Role; studentId?: string; parentId?: string }
) {
  if (requestUser) {
    if (requestUser.role === Role.ADMIN) {
      // Admin access allowed
    } else if (requestUser.role === Role.STUDENT && requestUser.studentId === targetStudentId) {
      // Self student allowed
    } else if (requestUser.role === Role.PARENT && requestUser.parentId) {
      const isLinked = await prisma.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId: requestUser.parentId,
            studentId: targetStudentId
          }
        }
      });
      if (!isLinked) {
        throw new BadRequestError('You do not have permission to view XP history for this student');
      }
    } else {
      throw new BadRequestError('You do not have permission to view XP history for this student');
    }
  }

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const where = { studentId: targetStudentId };

  const [total, items] = await Promise.all([
    prisma.xPTransaction.count({ where }),
    prisma.xPTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
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

export async function getMonthlyLeaderboard(
  query: LeaderboardQuery,
  requestUser: { userId: string; role: Role; studentId?: string }
) {
  const now = new Date();
  const year = query.year || now.getFullYear();
  const month = query.month || now.getMonth() + 1; // 1-12
  const period = query.period || 'monthly';

  // Check if finalized archive exists (only applicable for monthly period)
  if (period === 'monthly') {
    const finalized = await prisma.monthlyLeaderboard.findUnique({
      where: { year_month: { year, month } },
      include: {
        entries: {
          orderBy: { rank: 'asc' },
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } }
              }
            }
          }
        }
      }
    });

    if (finalized && finalized.status === LeaderboardStatus.FINALIZED) {
      const myEntry = finalized.entries.find((e) => e.studentId === requestUser.studentId);
      const isAdmin = requestUser.role === Role.ADMIN;

      return {
        year,
        month,
        period,
        status: LeaderboardStatus.FINALIZED,
        isFinalized: true,
        revealDate: finalized.revealDate,
        totalParticipants: finalized.entries.length,
        myRank: myEntry?.rank || null,
        myMonthlyXp: myEntry?.monthlyXp || 0,
        entries: finalized.entries.map((e) => {
          const isCurrentStudent = requestUser.studentId === e.studentId;
          const isTop3 = e.rank <= 3;
          const canViewIdentity = isAdmin || isCurrentStudent || isTop3;

          return {
            rank: e.rank,
            anonymousCode: canViewIdentity ? e.anonymousCode : '••••',
            monthlyXp: isAdmin || isCurrentStudent || isTop3 ? e.monthlyXp : null,
            isCurrentStudent,
            ...(canViewIdentity
              ? {
                  studentId: isAdmin ? e.studentId : undefined,
                  studentCode: isAdmin ? e.student.studentCode : undefined,
                  studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
                  avatarUrl: e.student.user.avatarUrl
                }
              : {})
          };
        })
      };
    }
  }

  // Calculate Date Range based on period
  let startDate: Date;
  let endDate: Date;

  if (period === 'weekly') {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    endDate = new Date();
  } else if (period === 'semester') {
    startDate = new Date(Date.UTC(year, Math.max(0, month - 6), 1, 0, 0, 0));
    endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  } else {
    startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  }

  const allStudents = await prisma.student.findMany({
    where: query.groupId
      ? { enrollments: { some: { groupId: query.groupId, isActive: true } } }
      : undefined,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true
        }
      },
      xpTransactions: {
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        },
        select: { amount: true }
      }
    }
  });

  // Calculate XP per student
  const studentScores = allStudents.map((s) => {
    const periodXp = s.xpTransactions.reduce((acc, tx) => acc + tx.amount, 0);
    return {
      studentId: s.id,
      studentCode: s.studentCode,
      anonymousCode: s.anonymousLeaderboardCode,
      monthlyXp: periodXp,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      avatarUrl: s.user.avatarUrl
    };
  });

  // Sort descending by monthlyXp
  studentScores.sort((a, b) => b.monthlyXp - a.monthlyXp);

  const isAdmin = requestUser.role === Role.ADMIN;
  const myIndex = studentScores.findIndex((s) => s.studentId === requestUser.studentId);
  const myRank = myIndex !== -1 ? myIndex + 1 : null;
  const myMonthlyXp = myIndex !== -1 ? studentScores[myIndex].monthlyXp : 0;

  const rankedEntries = studentScores.map((s, index) => {
    const isCurrentStudent = requestUser.studentId === s.studentId;

    if (isAdmin) {
      return {
        rank: index + 1,
        studentId: s.studentId,
        studentCode: s.studentCode,
        studentName: `${s.firstName} ${s.lastName}`,
        avatarUrl: s.avatarUrl,
        anonymousCode: s.anonymousCode,
        monthlyXp: s.monthlyXp,
        isCurrentStudent
      };
    }

    if (isCurrentStudent) {
      return {
        rank: index + 1,
        anonymousCode: s.anonymousCode,
        monthlyXp: s.monthlyXp,
        isCurrentStudent: true,
        studentName: `${s.firstName} ${s.lastName}`,
        avatarUrl: s.avatarUrl
      };
    }

    // Protect privacy of other students
    return {
      rank: index + 1,
      anonymousCode: '••••',
      monthlyXp: null,
      isCurrentStudent: false
    };
  });

  return {
    year,
    month,
    period,
    status: LeaderboardStatus.ACTIVE,
    isFinalized: false,
    totalParticipants: studentScores.length,
    myRank,
    myMonthlyXp,
    entries: rankedEntries
  };
}

export async function finalizeMonthlyLeaderboard(
  year: number,
  month: number,
  actorUserId?: string
) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  const allStudents = await prisma.student.findMany({
    include: {
      user: true,
      xpTransactions: {
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        },
        select: { amount: true }
      }
    }
  });

  const scores = allStudents.map((s) => ({
    studentId: s.id,
    anonymousCode: s.anonymousLeaderboardCode,
    monthlyXp: s.xpTransactions.reduce((acc, tx) => acc + tx.amount, 0)
  }));

  scores.sort((a, b) => b.monthlyXp - a.monthlyXp);

  const leaderboard = await prisma.$transaction(async (tx) => {
    const lb = await tx.monthlyLeaderboard.upsert({
      where: { year_month: { year, month } },
      create: {
        year,
        month,
        status: LeaderboardStatus.FINALIZED,
        revealDate: new Date()
      },
      update: {
        status: LeaderboardStatus.FINALIZED,
        revealDate: new Date()
      }
    });

    // Clear any previous entries
    await tx.monthlyLeaderboardEntry.deleteMany({
      where: { leaderboardId: lb.id }
    });

    // Insert ranked snapshot entries
    await tx.monthlyLeaderboardEntry.createMany({
      data: scores.map((s, index) => ({
        leaderboardId: lb.id,
        studentId: s.studentId,
        rank: index + 1,
        monthlyXp: s.monthlyXp,
        anonymousCode: s.anonymousCode || `ANON-${s.studentId.slice(0, 4).toUpperCase()}`
      }))
    });

    return lb;
  });

  const studentUserIds = allStudents.map((s) => s.userId);
  await createBulkNotifications(
    studentUserIds,
    'Leaderboard Finalized',
    `The leaderboard for ${month}/${year} has been finalized and revealed! Check out the final ranks.`,
    NotificationType.LEADERBOARD_FINALIZED
  );

  await createAuditLog({
    actorUserId,
    action: 'LEADERBOARD_FINALIZED',
    entityType: 'MonthlyLeaderboard',
    entityId: leaderboard.id,
    metadata: { year, month, totalParticipants: scores.length }
  });

  return leaderboard;
}
