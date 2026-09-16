import { z } from 'zod';
import { SubmissionStatus } from '@prisma/client';

const safeHttpUrlSchema = z
  .string()
  .url({ message: 'Must be a valid URL' })
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'URL protocol must be http: or https:' }
  );

export const createSubmissionSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().optional(),
  fileUrl: safeHttpUrlSchema.optional().or(z.literal('')),
  githubUrl: safeHttpUrlSchema.optional().or(z.literal(''))
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
