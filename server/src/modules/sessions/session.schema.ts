import { z } from 'zod';
import { SessionStatus } from '@prisma/client';

export const createSessionSchema = z.object({
  groupId: z.string().uuid(),
  sessionNumber: z.coerce.number().int().min(1).optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format').optional(),
  isOverride: z.boolean().optional().default(false),
  status: z.nativeEnum(SessionStatus).default(SessionStatus.SCHEDULED),
  lessonIds: z.array(z.string().uuid()).optional()
});

export const updateSessionSchema = z.object({
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.nativeEnum(SessionStatus).optional()
});

export const listSessionsQuerySchema = z.object({
  groupId: z.string().uuid().optional(),
  status: z.nativeEnum(SessionStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
