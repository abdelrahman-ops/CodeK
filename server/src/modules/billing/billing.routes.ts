import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { z } from 'zod';
import {
  checkoutSchema,
  submitManualPaymentSchema,
  rejectManualPaymentSchema,
  updatePaymentSettingsSchema,
  bulkConfirmManualPaymentsSchema,
  bulkRejectManualPaymentsSchema,
  bulkPlanStatusSchema,
  cancelSubscriptionSchema,
  adminListSubscriptionsQuerySchema,
  adminListTransactionsQuerySchema,
  adminRefundSchema,
  adminRecordManualPaymentSchema,
  createPlanSchema,
  updatePlanSchema
} from './billing.schema.js';
import * as billingService from './billing.service.js';

export async function billingRoutes(app: FastifyInstance) {
  // ─── Public Endpoints ────────────────────────────────────

  // List active grade plans with current prices (Public, unauthenticated for registration UI)
  app.get('/grade-plans', async (_request, reply) => {
    const plans = await billingService.listPublicGradePlans();
    return reply.send({ data: plans });
  });

  // Get available payment methods & transfer instructions (Public)
  app.get('/payment-methods', async (_request, reply) => {
    const methods = await billingService.getPublicPaymentMethods();
    return reply.send({ data: methods });
  });

  // ─── Student Endpoints ─────────────────────────────────

  // Student submits manual payment transfer proof/reference
  app.post(
    '/manual-payments/:transactionId/submit',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.user?.studentId) {
        return reply.status(403).send({ error: 'Only students can submit payments' });
      }
      const { transactionId } = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const input = submitManualPaymentSchema.parse(request.body || {});
      const result = await billingService.submitManualPayment(transactionId, request.user.studentId, input);
      return reply.send({ data: result });
    }
  );

  // Create checkout session → returns clientSecret for Paymob Embedded Checkout
  app.post(
    '/checkout',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.user?.studentId) {
        return reply.status(403).send({ error: 'Only students can subscribe' });
      }
      const input = checkoutSchema.parse(request.body || {});
      const result = await billingService.createCheckoutSession(
        request.user.studentId,
        request.user.userId,
        input
      );
      return reply.status(201).send({ data: result });
    }
  );

  // Verify payment redirect return from gateway (Paymob, etc.)
  app.post(
    '/verify-redirect',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const input = (request.body || {}) as Record<string, any>;
      const result = await billingService.verifyPaymentRedirect(input, request.user!);
      return reply.send({ data: result });
    }
  );

  // Get current subscription status
  app.get(
    '/my-subscription',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.user?.studentId) {
        return reply.send({ data: { subscription: null, plan: null, isActive: false } });
      }
      const result = await billingService.getStudentSubscription(request.user.studentId);
      return reply.send({ data: result });
    }
  );

  // Get payment history
  app.get(
    '/my-payments',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.user?.studentId) {
        return reply.send({ data: [] });
      }
      const payments = await billingService.getStudentPaymentHistory(request.user.studentId);
      return reply.send({ data: payments });
    }
  );

  // Cancel subscription (at period end)
  app.post(
    '/cancel',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.user?.studentId) {
        return reply.status(403).send({ error: 'Only students can cancel subscriptions' });
      }
      const input = cancelSubscriptionSchema.parse(request.body || {});
      const result = await billingService.cancelSubscription(
        request.user.studentId,
        request.user.userId,
        input.reason
      );
      return reply.send({ data: result });
    }
  );

  // ─── Webhook Endpoint (Unauthenticated — HMAC verified) ───

  app.post(
    '/webhooks/paymob',
    async (request, reply) => {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers[key] = value;
      }

      const query: Record<string, string> = {};
      if (request.query && typeof request.query === 'object') {
        for (const [key, value] of Object.entries(request.query as Record<string, any>)) {
          if (typeof value === 'string') query[key] = value;
        }
      }

      const result = await billingService.handlePaymentWebhook(
        'PAYMOB',
        headers,
        request.body,
        query
      );

      if (!result.processed && result.message === 'HMAC verification failed') {
        return reply.status(403).send({ error: 'Invalid webhook signature' });
      }

      return reply.send({ status: 'ok', ...result });
    }
  );

  // ─── Admin Endpoints ─────────────────────────────────────

  // List all subscriptions
  app.get(
    '/admin/subscriptions',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = adminListSubscriptionsQuerySchema.parse(request.query);
      const result = await billingService.adminListSubscriptions(query);
      return reply.send({ data: result.items, meta: result.meta });
    }
  );

  // List all payment transactions (with server-side search, filtering, and pagination)
  app.get(
    '/admin/transactions',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = adminListTransactionsQuerySchema.parse(request.query);
      const result = await billingService.adminListTransactions(query);
      return reply.send({
        data: result.items,
        pagination: result.pagination,
        meta: result.meta
      });
    }
  );

  // Refund a transaction
  app.post(
    '/admin/transactions/:id/refund',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = adminRefundSchema.parse(request.body);
      const result = await billingService.adminRefundTransaction(id, input.reason, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Record manual Hybrid payment (Admin only)
  const handleManualPayment = async (request: any, reply: any) => {
    const input = adminRecordManualPaymentSchema.parse(request.body);
    const result = await billingService.adminRecordManualPayment(input, request.user!.userId);
    return reply.status(201).send({ data: result });
  };

  app.post('/admin/manual-payment', { preHandler: [authenticate, requireAdmin] }, handleManualPayment);
  app.post('/admin/manual-record', { preHandler: [authenticate, requireAdmin] }, handleManualPayment);

  // Payment Settings (Admin only)
  app.get(
    '/admin/settings',
    { preHandler: [authenticate, requireAdmin] },
    async (_request, reply) => {
      const settings = await billingService.getPaymentSettings();
      return reply.send({ data: settings });
    }
  );

  app.patch(
    '/admin/settings',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = updatePaymentSettingsSchema.parse(request.body || {});
      const updated = await billingService.updatePaymentSettings(input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Manual payment single confirm & reject
  app.post(
    '/admin/manual-payments/:transactionId/confirm',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { transactionId } = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const result = await billingService.adminConfirmManualPayment(transactionId, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  app.post(
    '/admin/manual-payments/:transactionId/reject',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { transactionId } = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const input = rejectManualPaymentSchema.parse(request.body || {});
      const result = await billingService.adminRejectManualPayment(transactionId, input.reason, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // General Transaction Approval & Rejection (Any provider: Paymob, Vodafone Cash, InstaPay, etc.)
  app.post(
    '/admin/transactions/:transactionId/approve',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { transactionId } = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const result = await billingService.adminConfirmManualPayment(transactionId, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  app.post(
    '/admin/transactions/:transactionId/reject',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { transactionId } = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const input = rejectManualPaymentSchema.parse(request.body || {});
      const result = await billingService.adminRejectManualPayment(transactionId, input.reason, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Manual payment bulk confirm & reject
  app.post(
    '/admin/manual-payments/bulk-confirm',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkConfirmManualPaymentsSchema.parse(request.body || {});
      const result = await billingService.adminBulkConfirmManualPayments(input.ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  app.post(
    '/admin/manual-payments/bulk-reject',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkRejectManualPaymentsSchema.parse(request.body || {});
      const result = await billingService.adminBulkRejectManualPayments(input.ids, input.reason, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // ─── Admin Plan Management (CRUD & Bulk) ─────────────────

  // Bulk update plan status (active / inactive)
  app.patch(
    '/admin/plans/bulk-status',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkPlanStatusSchema.parse(request.body || {});
      const result = await billingService.adminBulkUpdatePlanStatus(input.ids, input.isActive, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // List all plans (with normalized structured benefits)
  app.get(
    '/admin/plans',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const plans = await billingService.adminListPlans();
      return reply.send({ data: plans });
    }
  );

  // Create a new subscription plan
  app.post(
    '/admin/plans',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createPlanSchema.parse(request.body);
      const plan = await billingService.adminCreatePlan(input, request.user!.userId);
      return reply.status(201).send({ data: plan });
    }
  );

  // Update an existing plan
  app.patch(
    '/admin/plans/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const input = updatePlanSchema.parse(request.body);
      const updated = await billingService.adminUpdatePlan(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete / Soft-deactivate a plan
  app.delete(
    '/admin/plans/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const result = await billingService.adminDeletePlan(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}

