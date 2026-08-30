import { z } from 'zod';
import { Difficulty, Role } from '@prisma/client';

export const createStudentUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  schoolName: z.string().optional(),
  dateOfBirth: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  programmingLevel: z.nativeEnum(Difficulty).default(Difficulty.BEGINNER),
  groupId: z.string().uuid().optional(),
  customPassword: z.string().min(6).optional()
});

export const createParentUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  studentIds: z.array(z.string().uuid()).optional(),
  customPassword: z.string().min(6).optional()
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional()
});

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateStudentUserInput = z.infer<typeof createStudentUserSchema>;
export type CreateParentUserInput = z.infer<typeof createParentUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
