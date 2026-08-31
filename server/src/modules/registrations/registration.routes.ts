import { FastifyInstance } from 'fastify';
import {
  createPublicRegistrationSchema,
  updateRegistrationSettingsSchema,
  updateRegistrationSchema,
  approveRegistrationSchema
} from './registration.schema.js';
import {
  getPublicRegistrationStatus,
  createPublicRegistration,
  listAdminRegistrations,
  getAdminRegistrationById,
  updateAdminRegistration,
  approveRegistrationAndCreateStudent,
  updateRegistrationSettings
} from './registration.service.js';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { Role } from '@prisma/client';

export async function registrationRoutes(app: FastifyInstance) {
  // Public Endpoint: Check registration status
  app.get('/public/registration-status', async (req, reply) => {
    const status = await getPublicRegistrationStatus();
    return reply.send({
      success: true,
      data: status
    });
  });

  // Public Endpoint: Submit registration form
  app.post('/public/registrations', async (req, reply) => {
    const parseResult = createPublicRegistrationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request input data',
          details: parseResult.error.flatten()
        }
      });
    }

    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const registration = await createPublicRegistration(parseResult.data, clientIp);

    return reply.status(201).send({
      success: true,
      data: registration
    });
  });

  // Admin Endpoints Group
  app.register(async (adminRoutes) => {
    adminRoutes.addHook('onRequest', authenticate);
    adminRoutes.addHook('onRequest', requireAdmin);

    // List Registrations
    adminRoutes.get('/admin/registrations', async (req, reply) => {
      const query = req.query as any;
      const result = await listAdminRegistrations({
        search: query.search,
        status: query.status,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20
      });

      return reply.send({
        success: true,
        data: result.items,
        counts: result.counts,
        settings: result.settings,
        meta: result.meta
      });
    });

    // Get Registration Settings
    adminRoutes.get('/admin/registrations/settings', async (req, reply) => {
      const status = await getPublicRegistrationStatus();
      return reply.send({
        success: true,
        data: status
      });
    });

    // Update Registration Settings
    adminRoutes.patch('/admin/registrations/settings', async (req, reply) => {
      const parseResult = updateRegistrationSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid settings payload',
            details: parseResult.error.flatten()
          }
        });
      }

      const settings = await updateRegistrationSettings(parseResult.data);
      return reply.send({
        success: true,
        data: settings
      });
    });

    // Get Single Registration Details
    adminRoutes.get('/admin/registrations/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const registration = await getAdminRegistrationById(id);
      return reply.send({
        success: true,
        data: registration
      });
    });

    // Update Registration Status or Notes
    adminRoutes.patch('/admin/registrations/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const parseResult = updateRegistrationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parseResult.error.flatten()
          }
        });
      }

      const updated = await updateAdminRegistration(id, parseResult.data, req.user!.userId);
      return reply.send({
        success: true,
        data: updated
      });
    });

    // Approve Registration & Create Student Account
    adminRoutes.post('/admin/registrations/:id/approve', async (req, reply) => {
      const { id } = req.params as { id: string };
      const parseResult = approveRegistrationSchema.safeParse(req.body || {});
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid approve payload',
            details: parseResult.error.flatten()
          }
        });
      }

      const result = await approveRegistrationAndCreateStudent(id, parseResult.data, req.user!.userId);
      return reply.send({
        success: true,
        data: result
      });
    });
  });
}
