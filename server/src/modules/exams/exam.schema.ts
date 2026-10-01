import { z } from 'zod';
import { QuestionType, StudentGrade } from '@prisma/client';

export const createExamSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional(),
  curriculumId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional().nullable(),
  isQuiz: z.boolean().optional().default(false),
  startsAt: z.string().datetime().optional().default(() => new Date().toISOString()),
  endsAt: z.string().datetime().optional().default(() => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()),
  durationMinutes: z.coerce.number().int().min(1).default(45),
  totalMarks: z.coerce.number().int().min(1).default(100),
  xpReward: z.coerce.number().int().min(1).default(100),
  isPublished: z.boolean().default(false)
});

export const updateExamSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  curriculumId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  isQuiz: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  durationMinutes: z.coerce.number().int().min(1).optional(),
  totalMarks: z.coerce.number().int().min(1).optional(),
  xpReward: z.coerce.number().int().min(1).optional(),
  isPublished: z.boolean().optional()
});

export const createExamQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  questionType: z.nativeEnum(QuestionType).default(QuestionType.MULTIPLE_CHOICE),
  options: z.array(z.string()).optional(), // Array of choices for MCQ
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  marks: z.coerce.number().int().min(1).default(5),
  order: z.coerce.number().int().min(1).default(1)
});

export const submitExamAttemptSchema = z.object({
  answers: z.record(z.string(), z.string()) // { [questionId]: studentAnswer }
});

export const listExamsQuerySchema = z.object({
  curriculumId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  isQuiz: z.coerce.boolean().optional(),
  grade: z.nativeEnum(StudentGrade).optional()
});

export const bulkPublishExamsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one exam ID is required'),
  isPublished: z.boolean()
});

export const bulkDeleteExamsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one exam ID is required')
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type CreateExamQuestionInput = z.infer<typeof createExamQuestionSchema>;
export type SubmitExamAttemptInput = z.infer<typeof submitExamAttemptSchema>;
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;
export type BulkPublishExamsInput = z.infer<typeof bulkPublishExamsSchema>;
export type BulkDeleteExamsInput = z.infer<typeof bulkDeleteExamsSchema>;
