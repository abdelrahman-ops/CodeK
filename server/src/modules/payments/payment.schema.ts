import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';

export const recordPaymentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  year: z.coerce.number().int().min(2020, 'Year must be 2020 or later'),
  month: z.coerce.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  amount: z.coerce.number().int().min(1, 'Payment amount must be greater than zero'), // EGP
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.PAID),
  notes: z.string().optional().nullable()
});

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().int().min(1, 'Payment amount must be greater than zero').optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  notes: z.string().optional().nullable()
});

export const listPaymentsQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  groupId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
