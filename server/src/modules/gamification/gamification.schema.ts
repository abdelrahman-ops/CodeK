import { z } from 'zod';

export const createAchievementSchema = z.object({
  code: z.string().min(1, 'Code is required').toUpperCase().trim(),
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().min(1, 'Description is required'),
  icon: z.string().min(1, 'Icon is required'),
  xpReward: z.coerce.number().int().min(0).default(50),
  isActive: z.boolean().default(true)
});

export const awardAchievementSchema = z.object({
  studentId: z.string().uuid(),
  achievementId: z.string().uuid()
});

export const listXpHistoryQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const leaderboardQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  groupId: z.string().uuid().optional(),
  period: z.enum(['weekly', 'monthly', 'semester']).optional()
});

export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;
export type AwardAchievementInput = z.infer<typeof awardAchievementSchema>;
export type ListXpHistoryQuery = z.infer<typeof listXpHistoryQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
