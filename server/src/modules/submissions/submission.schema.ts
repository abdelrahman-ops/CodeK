import { z } from 'zod';
import { SubmissionStatus } from '@prisma/client';

export const createSubmissionSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal(''))
}).refine((data) => Boolean(data.content || data.fileUrl || data.githubUrl), {
  message: 'At least one submission field (content, fileUrl, or githubUrl) is required'
});

export const reviewSubmissionSchema = z.object({
  status: z.nativeEnum(SubmissionStatus),
  feedback: z.string().optional()
});

export const listSubmissionsQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.nativeEnum(SubmissionStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
