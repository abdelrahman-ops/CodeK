import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin, requireStudent } from '../../common/middleware/rbac.js';
import {
  adminMarkAttendanceSchema,
  adminBulkMarkAttendanceSchema,
  confirmStudentAttendanceSchema
} from './attendance.schema.js';
import * as attendanceService from './attendance.service.js';
import { z } from 'zod';

export async function attendanceRoutes(app: FastifyInstance) {
  // Student scans QR & confirms attendance (instant unlock)
  app.post(
    '/confirm-student',
    { preHandler: [authenticate, requireStudent] },
    async (request, reply) => {
      const input = confirmStudentAttendanceSchema.parse(request.body);
      const rawToken = (input.token || input.qrToken)!;
      const result = await attendanceService.confirmStudentAttendance(
        request.user!.userId,
        input.sessionId,
        rawToken
      );
      return reply.send({ data: result });
    }
  );

  // Admin manually mark attendance (PRESENT/ABSENT)
  app.post(
    '/admin-mark',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = adminMarkAttendanceSchema.parse(request.body);
      const result = await attendanceService.adminMarkAttendance(
        input.sessionId,
        input.studentId,
        input.status,
        input.notes,
        request.user!.userId
      );
      return reply.send({ data: result });
    }
  );

  // Admin bulk mark attendance (PRESENT/ABSENT)
  app.post(
    '/admin-bulk-mark',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = adminBulkMarkAttendanceSchema.parse(request.body || {});
      const result = await attendanceService.adminBulkMarkAttendance(
        input.sessionId,
        input.studentIds,
        input.status,
        input.notes,
        request.user!.userId
      );
      return reply.send({ data: result });
    }
  );

  // Get session attendance list & live roster (Admin)
  app.get(
    '/session/:sessionId',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(request.params);
      const result = await attendanceService.getSessionAttendanceList(sessionId);
      return reply.send({ data: result });
    }
  );
}
