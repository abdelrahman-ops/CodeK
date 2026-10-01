import { z } from 'zod';
import { AccessGrantScope } from '@prisma/client';

export const createAccessGrantSchema = z.object({
  studentId: z.string().uuid(),
  scope: z.nativeEnum(AccessGrantScope).default(AccessGrantScope.ALL_ACCESS),
  curriculumId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  reason: z.string().min(1, 'Reason is required').trim(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional().nullable()
});

export const revokeAccessGrantSchema = z.object({
  reason: z.string().optional()
});

export const listAccessGrantsQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  scope: z.nativeEnum(AccessGrantScope).optional(),
  isActive: z.coerce.boolean().optional()
});

export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  code: z.string().min(1, 'Code is required').trim().toUpperCase(),
  description: z.string().optional(),
  price: z.coerce.number().int().min(0, 'Price must be non-negative'),
  currency: z.string().default('EGP'),
  billingInterval: z.string().default('MONTHLY'),
  isActive: z.boolean().default(true),
  features: z.any().optional()
});

export type CreateAccessGrantInput = z.infer<typeof createAccessGrantSchema>;
export type RevokeAccessGrantInput = z.infer<typeof revokeAccessGrantSchema>;
export type ListAccessGrantsQuery = z.infer<typeof listAccessGrantsQuerySchema>;
export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;
