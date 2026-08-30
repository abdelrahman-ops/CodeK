import { prisma } from '../../db/prisma.js';
import { ListAuditLogsQuery } from './audit.schema.js';

export async function createAuditLog(params: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      }
    });
  } catch (error) {
    // Fail silently on audit log creation error so we do not block core transactions
    console.error('Failed to create audit log:', error);
    return null;
  }
}

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const { action, entityType, entityId, actorUserId, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(actorUserId ? { actorUserId } : {})
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            loginId: true,
            firstName: true,
            lastName: true,
            role: true
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
