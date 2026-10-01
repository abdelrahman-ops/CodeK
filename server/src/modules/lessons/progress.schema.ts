import { z } from 'zod';
import { LessonProgressStatus } from '@prisma/client';

export const updateLessonProgressSchema = z.object({
  status: z.nativeEnum(LessonProgressStatus).optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
  lastWatchedPosition: z.number().int().min(0).optional(),
  completed: z.boolean().optional()
});

export type UpdateLessonProgressInput = z.infer<typeof updateLessonProgressSchema>;
