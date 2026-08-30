import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorUserId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
