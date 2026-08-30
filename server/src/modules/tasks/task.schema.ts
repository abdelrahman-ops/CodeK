import { z } from 'zod';
import { Difficulty, TaskType } from '@prisma/client';

export const createTaskSchema = z.object({
  lessonId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().min(1, 'Description is required'),
  instructions: z.string().min(1, 'Instructions are required'),
  taskType: z.nativeEnum(TaskType).default(TaskType.DAILY_TASK),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.BEGINNER),
  estimatedDurationMinutes: z.coerce.number().int().min(1).default(45),
  xpReward: z.coerce.number().int().min(1).default(30),
  isPublished: z.boolean().default(true),
  groupIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime().optional()
});

export const assignTaskSchema = z.object({
  groupId: z.string().uuid(),
  availableAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional()
});

export const updateTaskSchema = z.object({
  lessonId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  taskType: z.nativeEnum(TaskType).optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).optional(),
  xpReward: z.coerce.number().int().min(1).optional(),
  isPublished: z.boolean().optional()
});

export const listTasksQuerySchema = z.object({
  lessonId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  taskType: z.nativeEnum(TaskType).optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  isPublished: z.boolean().optional()
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
