import { z } from 'zod';
import { Difficulty, StudentGrade } from '@prisma/client';

export const listStudentsQuerySchema = z.object({
  groupId: z.string().uuid().optional(),
  grade: z.nativeEnum(StudentGrade).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const updateStudentSchema = z.object({
  programmingLevel: z.nativeEnum(Difficulty).optional(),
  grade: z.nativeEnum(StudentGrade).optional().nullable(),
  schoolName: z.string().optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  groupId: z.string().uuid().optional().nullable(),
  attendanceRequired: z.boolean().optional()
});

export const resetStudentPasswordSchema = z.object({
  customPassword: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
  mustChangePassword: z.boolean().optional().default(true)
});

export const bulkStudentStatusSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student ID is required'),
  isActive: z.boolean()
});

export const bulkAssignGroupSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student ID is required'),
  groupId: z.string().uuid().nullable()
});

export const bulkDeleteStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student ID is required')
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ResetStudentPasswordInput = z.infer<typeof resetStudentPasswordSchema>;
export type BulkStudentStatusInput = z.infer<typeof bulkStudentStatusSchema>;
export type BulkAssignGroupInput = z.infer<typeof bulkAssignGroupSchema>;
export type BulkDeleteStudentsInput = z.infer<typeof bulkDeleteStudentsSchema>;
