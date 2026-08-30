import { prisma } from '../../db/prisma.js';
import { generateRandomToken, hashToken } from '../../common/utils/crypto.js';
import { CreateSessionInput, ListSessionsQuery, UpdateSessionInput } from './session.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import { SessionStatus } from '@prisma/client';

export async function createSession(input: CreateSessionInput, actorUserId?: string) {
  const existing = await prisma.session.findUnique({
    where: {
      groupId_sessionNumber: {
        groupId: input.groupId,
        sessionNumber: input.sessionNumber
      }
    }
  });

  if (existing) {
    throw new BadRequestError(`Session #${input.sessionNumber} already exists for this group`);
  }

  const session = await prisma.session.create({
    data: {
      groupId: input.groupId,
      sessionNumber: input.sessionNumber,
      date: new Date(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
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
    metadata: { groupId: input.groupId, sessionNumber: input.sessionNumber }
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
      _count: { select: { attendances: true } }
    }
  });

  if (!session) throw new NotFoundError('Session not found');

  if (session._count.attendances > 0) {
    throw new BadRequestError('Cannot delete session with recorded student attendance. Mark the session completed or cancelled instead.');
  }

  await prisma.session.delete({ where: { id: sessionId } });

  await createAuditLog({
    actorUserId,
    action: 'SESSION_DELETED',
    entityType: 'Session',
    entityId: sessionId,
    metadata: { sessionNumber: session.sessionNumber }
  });

  return { success: true };
}
