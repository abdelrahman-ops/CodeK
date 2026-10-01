import { z } from 'zod';

export const createSectionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  order: z.number().int().min(1).optional().default(1),
  isPublished: z.boolean().optional().default(true)
});

export const updateSectionSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  order: z.number().int().min(1).optional(),
  isPublished: z.boolean().optional()
});

export const reorderSectionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(1)
    })
  ).min(1, 'At least one item required')
});

export const bulkPublishSectionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one section ID is required'),
  isPublished: z.boolean()
});

export const bulkDeleteSectionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one section ID is required')
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;
export type BulkPublishSectionsInput = z.infer<typeof bulkPublishSectionsSchema>;
export type BulkDeleteSectionsInput = z.infer<typeof bulkDeleteSectionsSchema>;
