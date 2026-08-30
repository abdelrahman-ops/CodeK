import { z } from 'zod';
import { CurriculumType } from '@prisma/client';

export const createCurriculumSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional(),
  type: z.nativeEnum(CurriculumType).default(CurriculumType.OFFICIAL_EB),
  track: z.string().optional(), // e.g. "Fundamentals", "Python", "AI", "Web Development"
  isPublished: z.boolean().default(true)
});

export const updateCurriculumSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.nativeEnum(CurriculumType).optional(),
  track: z.string().optional().nullable(),
  isPublished: z.boolean().optional()
});

export const listCurriculumQuerySchema = z.object({
  type: z.nativeEnum(CurriculumType).optional(),
  track: z.string().optional()
});

export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>;
export type ListCurriculumQuery = z.infer<typeof listCurriculumQuerySchema>;
