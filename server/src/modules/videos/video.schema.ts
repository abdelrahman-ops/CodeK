import { z } from 'zod';

export const createDirectUploadSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  maxDurationSeconds: z.number().int().min(10).max(14400).optional(),
  isPrivate: z.boolean().optional().default(true),
  lessonId: z.string().uuid().optional()
});

export const confirmUploadSchema = z.object({
  videoAssetId: z.string().uuid(),
  lessonId: z.string().uuid().optional()
});

export const connectExternalVideoSchema = z.object({
  url: z.string().min(3).max(1000),
  title: z.string().max(255).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  lessonId: z.string().uuid().optional()
});

export const attachVideoSchema = z.object({
  videoAssetId: z.string().uuid()
});

export type CreateDirectUploadInput = z.infer<typeof createDirectUploadSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type ConnectExternalVideoInput = z.infer<typeof connectExternalVideoSchema>;
export type AttachVideoInput = z.infer<typeof attachVideoSchema>;
