import { prisma } from '../../db/prisma.js';
import { CreateNotificationInput, ListNotificationsQuery } from './notification.schema.js';
import { NotFoundError } from '../../common/errors/app-error.js';

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type
    }
  });
}

export async function createBulkNotifications(
  userIds: string[],
  title: string,
  message: string,
  type: CreateNotificationInput['type']
) {
  if (userIds.length === 0) return;
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      message,
      type
    }))
  });
}

export async function listUserNotifications(userId: string, query: ListNotificationsQuery) {
  const { unreadOnly, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(unreadOnly ? { readAt: null } : {})
  };

  const [total, items, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.notification.count({
      where: { userId, readAt: null }
    })
  ]);

  return {
    items,
    meta: {
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id }
  });

  if (!notification || notification.userId !== userId) {
    throw new NotFoundError('Notification not found');
  }

  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() }
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
}
