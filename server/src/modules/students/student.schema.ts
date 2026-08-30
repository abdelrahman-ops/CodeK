import { z } from 'zod';
import { Difficulty } from '@prisma/client';

export const listStudentsQuerySchema = z.object({
  groupId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const updateStudentSchema = z.object({
  programmingLevel: z.nativeEnum(Difficulty).optional(),
  schoolName: z.string().optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable()
});

export const resetStudentPasswordSchema = z.object({
  customPassword: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
  mustChangePassword: z.boolean().optional().default(true)
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ResetStudentPasswordInput = z.infer<typeof resetStudentPasswordSchema>;
