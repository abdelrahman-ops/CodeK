import { prisma } from '../../db/prisma.js';
import { generateRandomToken, hashToken } from '../../common/utils/crypto.js';
import { CreateSessionInput, ListSessionsQuery, UpdateSessionInput } from './session.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import { SessionStatus } from '@prisma/client';

export async function getNextSessionNumber(groupId: string): Promise<number> {
  const lastSession = await prisma.session.findFirst({
    where: { groupId },
    orderBy: { sessionNumber: 'desc' }
  });
  return (lastSession?.sessionNumber ?? 0) + 1;
}

export async function getTodayScheduledGroups(targetDateStr?: string) {
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  const dayOfWeek = targetDate.getDay(); // 0=Sunday...6=Saturday

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const dateIsoString = `${yyyy}-${mm}-${dd}`;

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const activeGroups = await prisma.group.findMany({
    where: {
      isActive: true,
      schedules: {
        some: {
          dayOfWeek,
          isActive: true
        }
      }
    },
    include: {
      schedules: {
        where: { dayOfWeek, isActive: true }
      },
      sessions: {
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        orderBy: { sessionNumber: 'desc' }
      },
      _count: {
        select: {
          enrollments: { where: { isActive: true } }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  return Promise.all(
    activeGroups.map(async (g) => {
      const schedule = g.schedules[0];
      const existingSession = g.sessions[0] || null;
      const nextSessionNumber = await getNextSessionNumber(g.id);

      return {
        groupId: g.id,
        groupName: g.name,
        description: g.description,
        enrolledStudentsCount: g._count.enrollments,
        targetDate: dateIsoString,
        dayOfWeek,
        schedule: schedule
          ? {
              id: schedule.id,
              startTime: schedule.startTime,
              endTime: schedule.endTime
            }
          : null,
        nextSessionNumber,
        existingSession: existingSession
          ? {
              id: existingSession.id,
              sessionNumber: existingSession.sessionNumber,
              startTime: existingSession.startTime,
              endTime: existingSession.endTime,
              status: existingSession.status
            }
          : null
      };
    })
  );
}

export async function createSession(input: CreateSessionInput, actorUserId?: string) {
  const group = await prisma.group.findUnique({
    where: { id: input.groupId },
    include: {
      schedules: { where: { isActive: true } }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  if (!group.isActive) {
    throw new BadRequestError('Cannot create a session for an inactive group');
  }

  const sessionDate = input.date ? new Date(input.date) : new Date();
  if (isNaN(sessionDate.getTime())) {
    throw new BadRequestError('Invalid date provided');
  }

  const dayOfWeek = sessionDate.getDay();
  const scheduleForDay = group.schedules.find((s) => s.dayOfWeek === dayOfWeek);

  if (!input.isOverride && !scheduleForDay) {
    throw new BadRequestError(`Group "${group.name}" does not have a recurring schedule on day of week ${dayOfWeek}`);
  }

  const startTime = input.startTime || scheduleForDay?.startTime;
  const endTime = input.endTime || scheduleForDay?.endTime;

  if (!startTime || !endTime) {
    throw new BadRequestError('Start time and end time are required');
  }

  if (startTime >= endTime) {
    throw new BadRequestError('Start time must be strictly before end time');
  }

  const sessionNumber = input.sessionNumber || (await getNextSessionNumber(input.groupId));

  const existingNumber = await prisma.session.findUnique({
    where: {
      groupId_sessionNumber: {
        groupId: input.groupId,
        sessionNumber
      }
    }
  });

  if (existingNumber) {
    throw new BadRequestError(`Session #${sessionNumber} already exists for group "${group.name}"`);
  }

  const startOfDay = new Date(sessionDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(sessionDate);
  endOfDay.setHours(23, 59, 59, 999);

  const duplicateSession = await prisma.session.findFirst({
    where: {
      groupId: input.groupId,
      date: { gte: startOfDay, lte: endOfDay },
      startTime,
      status: { in: [SessionStatus.SCHEDULED, SessionStatus.ACTIVE, SessionStatus.COMPLETED] }
    }
  });

  if (duplicateSession) {
    throw new BadRequestError(`A session for "${group.name}" at ${startTime} on this date already exists`);
  }

  const session = await prisma.session.create({
    data: {
      groupId: input.groupId,
      sessionNumber,
      date: sessionDate,
      startTime,
      endTime,
      status: input.status,
      sessionLessons: input.lessonIds && input.lessonIds.length > 0
        ? {
            create: input.lessonIds.map((lessonId, index) => ({
              lessonId,
              order: index + 1
            }))
          }
        : undefined
    },
    include: {
      sessionLessons: { include: { lesson: true } },
      group: true
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'SESSION_CREATED',
    entityType: 'Session',
    entityId: session.id,
    metadata: { groupId: input.groupId, sessionNumber }
  });

  return session;
}

export async function listSessions(query: ListSessionsQuery) {
  const { groupId, status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(groupId ? { groupId } : {}),
    ...(status ? { status } : {})
  };

  const [total, items] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { sessionNumber: 'desc' }],
      include: {
        group: { select: { id: true, name: true } },
        sessionLessons: {
          include: {
            lesson: {
              select: { id: true, title: true, difficulty: true, isPublished: true }
            }
          }
        },
        _count: {
          select: {
            attendances: { where: { status: 'PRESENT' } }
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

export async function getSessionById(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      group: true,
      sessionLessons: {
        include: { lesson: true },
        orderBy: { order: 'asc' }
      },
      attendances: {
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Never return raw tokenHash or sensitive token secrets
  return {
    id: session.id,
    groupId: session.groupId,
    group: session.group,
    sessionNumber: session.sessionNumber,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    tokenExpiresAt: session.tokenExpiresAt,
    sessionLessons: session.sessionLessons,
    attendances: session.attendances,
    hasActiveToken: Boolean(session.tokenHash && session.tokenExpiresAt && session.tokenExpiresAt > new Date())
  };
}

export async function startSession(sessionId: string, actorUserId?: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const rawToken = generateRandomToken(16);
  const tokenHash = hashToken(rawToken);

  const tokenExpiresAt = new Date();
  tokenExpiresAt.setMinutes(tokenExpiresAt.getMinutes() + 10); // 10 minutes QR expiry

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.ACTIVE,
      tokenHash,
      tokenExpiresAt
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'SESSION_STARTED',
    entityType: 'Session',
    entityId: sessionId,
    metadata: { sessionNumber: session.sessionNumber }
  });

  // Return rawToken ONCE to the admin client
  return {
    sessionId: updated.id,
    status: updated.status,
    qrToken: rawToken,
    expiresAt: tokenExpiresAt
  };
}

export async function getSessionQrToken(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  if (session.status !== SessionStatus.ACTIVE || !session.tokenHash || !session.tokenExpiresAt) {
    throw new BadRequestError('Session is not active or has no active attendance token');
  }

  if (session.tokenExpiresAt < new Date()) {
    throw new BadRequestError('Attendance QR token has expired. Please restart/regenerate token.');
  }

  return {
    sessionId: session.id,
    expiresAt: session.tokenExpiresAt
  };
}

export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput,
  actorUserId?: string
) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      date: input.date ? new Date(input.date) : undefined,
      startTime: input.startTime !== undefined ? input.startTime : undefined,
      endTime: input.endTime !== undefined ? input.endTime : undefined,
      status: input.status !== undefined ? input.status : undefined
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'SESSION_UPDATED',
    entityType: 'Session',
    entityId: sessionId,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteSession(sessionId: string, actorUserId?: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      _count: { select: { attendances: true, sessionLessons: true } }
    }
  });

  if (!session) throw new NotFoundError('Session not found');

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { sessionId } });
    await tx.sessionLesson.deleteMany({ where: { sessionId } });
    await tx.session.delete({ where: { id: sessionId } });
  });

  await createAuditLog({
    actorUserId,
    action: 'SESSION_DELETED',
    entityType: 'Session',
    entityId: sessionId,
    metadata: {
      sessionNumber: session.sessionNumber,
      groupId: session.groupId,
      deletedAttendancesCount: session._count.attendances
    }
  });

  return { success: true };
}
