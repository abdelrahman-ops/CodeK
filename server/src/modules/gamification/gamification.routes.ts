import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  awardAchievementSchema,
  createAchievementSchema,
  leaderboardQuerySchema,
  listXpHistoryQuerySchema
} from './gamification.schema.js';
import * as gamificationService from './gamification.service.js';
import { z } from 'zod';

export async function gamificationRoutes(app: FastifyInstance) {
  // Get XP History (Self, Parent, or Admin)
  app.get(
    '/xp-history',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listXpHistoryQuerySchema.parse(request.query);
      const targetStudentId = query.studentId || request.user!.studentId;
      if (!targetStudentId) {
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Student ID is required' } });
      }
      const result = await gamificationService.listXpHistory(targetStudentId, query, request.user!);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // List achievements
  app.get(
    '/achievements',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const achievements = await gamificationService.listAchievements(request.user?.studentId);
      return reply.send({ data: achievements });
    }
  );

  // Create achievement (Admin)
  app.post(
    '/achievements',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createAchievementSchema.parse(request.body);
      const achievement = await gamificationService.createAchievement(input, request.user!.userId);
      return reply.status(201).send({ data: achievement });
    }
  );

  // Award achievement manually (Admin)
  app.post(
    '/achievements/award',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = awardAchievementSchema.parse(request.body);
      const result = await gamificationService.awardAchievement(input, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Get current monthly leaderboard (Anonymous during month, with current student indicator)
  app.get(
    '/leaderboard',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = leaderboardQuerySchema.parse(request.query);
      const result = await gamificationService.getMonthlyLeaderboard(query, request.user!);
      return reply.send({ data: result });
    }
  );

  // Finalize monthly leaderboard & reveal rankings (Admin)
  app.post(
    '/leaderboard/finalize',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const body = z.object({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12)
      }).parse(request.body);

      const result = await gamificationService.finalizeMonthlyLeaderboard(
        body.year,
        body.month,
        request.user!.userId
      );
      return reply.send({ data: result });
    }
  );
}
