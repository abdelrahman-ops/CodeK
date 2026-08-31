import { z } from 'zod';

export const groupScheduleInputSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format'),
  isActive: z.boolean().optional().default(true)
}).refine((data) => data.startTime < data.endTime, {
  message: 'Start time must be before end time',
  path: ['endTime']
});

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').trim(),
  description: z.string().optional(),
  scheduleInfo: z.string().optional(), // e.g. "Saturday 5:00 PM"
  whatsappGroupUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  maxCapacity: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.boolean().default(true),
  schedules: z.array(groupScheduleInputSchema).optional()
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  scheduleInfo: z.string().optional().nullable(),
  whatsappGroupUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  maxCapacity: z.coerce.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  schedules: z.array(groupScheduleInputSchema).optional()
});

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid()
});

export const listGroupsQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional()
});

export type GroupScheduleInput = z.infer<typeof groupScheduleInputSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;

