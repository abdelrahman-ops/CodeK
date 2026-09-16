import { z } from 'zod';
import { Difficulty, LessonAccessType } from '@prisma/client';

export const createLessonSchema = z.object({
  curriculumId: z.string().uuid(),
  sectionId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional().nullable(),
  content: z.string().min(1, 'Content is required'), // Markdown or HTML
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.BEGINNER),
  estimatedDurationMinutes: z.coerce.number().int().min(1).default(45),
  order: z.coerce.number().int().min(1).default(1),
  isPublished: z.boolean().default(true),
  isFree: z.boolean().optional().default(false),
  accessType: z.nativeEnum(LessonAccessType).optional().default(LessonAccessType.SUBSCRIPTION_REQUIRED),
  videoUrl: z.string().url('Invalid video URL format').optional().or(z.literal('')).nullable(),
  videoDurationSeconds: z.coerce.number().int().min(0).optional().nullable(),
  videoId: z.string().uuid().optional().nullable(),
  externalResourceUrl: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  externalResourceTitle: z.string().optional().nullable(),
  sessionIds: z.array(z.string().uuid()).optional()
});

export const updateLessonSchema = z.object({
  curriculumId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).optional(),
  order: z.coerce.number().int().min(1).optional(),
  isPublished: z.boolean().optional(),
  isFree: z.boolean().optional(),
  accessType: z.nativeEnum(LessonAccessType).optional(),
  videoUrl: z.string().url('Invalid video URL format').optional().or(z.literal('')).nullable(),
  videoDurationSeconds: z.coerce.number().int().min(0).optional().nullable(),
  videoId: z.string().uuid().optional().nullable(),
  externalResourceUrl: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  externalResourceTitle: z.string().optional().nullable()
});

export const listLessonsQuerySchema = z.object({
  curriculumId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  difficulty: z.nativeEnum(Difficulty).optional()
});

export const linkLessonToSessionSchema = z.object({
  sessionId: z.string().uuid(),
  order: z.coerce.number().int().min(1).default(1)
});

export const reorderLessonsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(1),
      sectionId: z.string().uuid().optional().nullable()
    })
  ).min(1, 'At least one item required')
});

export const conceptCardSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  explanation: z.string().optional(),
  keyConcept: z.string().optional(),
  summary: z.string().optional(),
  takeaway: z.string().optional(),
  terminology: z.array(z.string()).optional().default([]),
  ministryReference: z.string().optional(),
  curriculumPage: z.union([z.number(), z.string()]).optional()
}).refine(
  (card) =>
    Boolean(
      (card.explanation && card.explanation.trim().length > 0) ||
      (card.summary && card.summary.trim().length > 0) ||
      (card.keyConcept && card.keyConcept.trim().length > 0) ||
      (card.takeaway && card.takeaway.trim().length > 0)
    ),
  { message: 'Concept card must have explanation, summary, keyConcept, or takeaway' }
);

export const conceptCardsDeckSchema = z.array(conceptCardSchema);
export type ConceptCard = z.infer<typeof conceptCardSchema>;

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>;
export type LinkLessonToSessionInput = z.infer<typeof linkLessonToSessionSchema>;
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;

export const bulkPublishLessonsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one lesson ID is required'),
  isPublished: z.boolean()
});

export const bulkDeleteLessonsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one lesson ID is required')
});

export type BulkPublishLessonsInput = z.infer<typeof bulkPublishLessonsSchema>;
export type BulkDeleteLessonsInput = z.infer<typeof bulkDeleteLessonsSchema>;

