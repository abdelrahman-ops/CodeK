import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').trim(),
  description: z.string().optional(),
  scheduleInfo: z.string().optional(), // e.g. "Saturday 5:00 PM"
  whatsappGroupUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  maxCapacity: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.boolean().default(true)
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  scheduleInfo: z.string().optional().nullable(),
  whatsappGroupUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  maxCapacity: z.coerce.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional()
});

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid()
});

export const listGroupsQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional()
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
