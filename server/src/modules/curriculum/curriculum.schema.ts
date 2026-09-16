import { z } from 'zod';
import { CurriculumType, StudentGrade } from '@prisma/client';

export const createCurriculumSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional(),
  type: z.nativeEnum(CurriculumType).default(CurriculumType.OFFICIAL_EB),
  track: z.string().optional(), // e.g. "Fundamentals", "Python", "AI", "Web Development"
  grade: z.nativeEnum(StudentGrade).default(StudentGrade.GRADE_2),
  isPublished: z.boolean().default(true)
});

export const updateCurriculumSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.nativeEnum(CurriculumType).optional(),
  track: z.string().optional().nullable(),
  grade: z.nativeEnum(StudentGrade).optional(),
  isPublished: z.boolean().optional()
});

export const listCurriculumQuerySchema = z.object({
  type: z.nativeEnum(CurriculumType).optional(),
  track: z.string().optional(),
  grade: z.nativeEnum(StudentGrade).optional()
});

export const bulkDeleteCurriculaSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one curriculum ID is required')
});

export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>;
export type ListCurriculumQuery = z.infer<typeof listCurriculumQuerySchema>;
export type BulkDeleteCurriculaInput = z.infer<typeof bulkDeleteCurriculaSchema>;
