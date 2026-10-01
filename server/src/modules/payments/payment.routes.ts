import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  listPaymentsQuerySchema,
  recordPaymentSchema,
  updatePaymentSchema,
  bulkPaymentStatusSchema
} from './payment.schema.js';
import * as paymentService from './payment.service.js';
import { z } from 'zod';

export async function paymentRoutes(app: FastifyInstance) {
  // Record or update monthly payment (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = recordPaymentSchema.parse(request.body);
      const payment = await paymentService.recordPayment(input, request.user!.userId);
      return reply.status(201).send({ data: payment });
    }
  );

  // Bulk update payment status (Admin only)
  app.patch(
    '/bulk-status',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkPaymentStatusSchema.parse(request.body || {});
      const result = await paymentService.bulkUpdatePaymentStatus(
        input.paymentIds,
        input.status,
        input.notes,
        request.user!.userId
      );
      return reply.send({ data: result });
    }
  );

  // List payments with filters (Admin)
  app.get(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = listPaymentsQuerySchema.parse(request.query);
      const result = await paymentService.listPayments(query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // Get monthly payment summary metrics (Admin)
  app.get(
    '/summary',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = z.object({
        year: z.coerce.number().int().optional(),
        month: z.coerce.number().int().min(1).max(12).optional()
      }).parse(request.query);

      const summary = await paymentService.getPaymentSummary(query.year, query.month);
      return reply.send({ data: summary });
    }
  );

  // Get payments for a specific student (Self, Linked Parent, or Admin)
  app.get(
    '/student/:studentId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { studentId } = z.object({ studentId: z.string().uuid() }).parse(request.params);
      const payments = await paymentService.getStudentPayments(studentId, request.user!);
      return reply.send({ data: payments });
    }
  );
}
