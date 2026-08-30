import { z } from 'zod';
import { Difficulty } from '@prisma/client';

export const createLessonSchema = z.object({
  curriculumId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional(),
  content: z.string().min(1, 'Content is required'), // Markdown
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.BEGINNER),
  estimatedDurationMinutes: z.coerce.number().int().min(1).default(45),
  order: z.coerce.number().int().min(1).default(1),
  isPublished: z.boolean().default(true),
  externalResourceUrl: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  externalResourceTitle: z.string().optional().nullable(),
  sessionIds: z.array(z.string().uuid()).optional()
});

export const updateLessonSchema = z.object({
  curriculumId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).optional(),
  order: z.coerce.number().int().min(1).optional(),
  isPublished: z.boolean().optional(),
  externalResourceUrl: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  externalResourceTitle: z.string().optional().nullable()
});

export const listLessonsQuerySchema = z.object({
  curriculumId: z.string().uuid().optional(),
  difficulty: z.nativeEnum(Difficulty).optional()
});

export const linkLessonToSessionSchema = z.object({
  sessionId: z.string().uuid(),
  order: z.coerce.number().int().min(1).default(1)
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>;
export type LinkLessonToSessionInput = z.infer<typeof linkLessonToSessionSchema>;
