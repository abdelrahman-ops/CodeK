import { z } from 'zod';
import { RelationshipType } from '@prisma/client';

export const linkChildSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.nativeEnum(RelationshipType).default(RelationshipType.GUARDIAN),
  isPrimary: z.boolean().default(false)
});

export const updateChildRelationshipSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.nativeEnum(RelationshipType),
  isPrimary: z.boolean().optional()
});

export type LinkChildInput = z.infer<typeof linkChildSchema>;
export type UpdateChildRelationshipInput = z.infer<typeof updateChildRelationshipSchema>;
