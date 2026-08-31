import Fastify from 'fastify';
import { env } from './config/env.js';
import { errorHandler } from './common/errors/error-handler.js';
import { registerSecurity } from './plugins/security.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerRateLimit } from './plugins/rate-limit.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { studentRoutes } from './modules/students/student.routes.js';
import { parentRoutes } from './modules/parents/parent.routes.js';
import { groupRoutes } from './modules/groups/group.routes.js';
import { sessionRoutes } from './modules/sessions/session.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { curriculumRoutes } from './modules/curriculum/curriculum.routes.js';
import { lessonRoutes } from './modules/lessons/lesson.routes.js';
import { taskRoutes } from './modules/tasks/task.routes.js';
import { submissionRoutes } from './modules/submissions/submission.routes.js';
import { examRoutes } from './modules/exams/exam.routes.js';
import { gamificationRoutes } from './modules/gamification/gamification.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { registrationRoutes } from './modules/registrations/registration.routes.js';

export async function buildApp() {
  const isVercel = process.env.VERCEL === '1';
  const usePrettyLogger = env.NODE_ENV === 'development' && !isVercel;

  const app = Fastify({
    logger: usePrettyLogger
      ? {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname'
            }
          }
        }
      : {
          level: env.NODE_ENV === 'test' ? 'silent' : 'info'
        }
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Core Plugins
  await registerSecurity(app);
  await registerSwagger(app);
  await registerRateLimit(app);

  // Root Welcome & Health Check
  app.get('/', async () => ({
    name: 'CodeK Academy API',
    version: '1.0.0',
    status: 'online',
    health: '/health',
    docs: '/docs'
  }));

  app.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV
  }));

  // API V1 Routes
  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(userRoutes, { prefix: '/users' });
      await v1.register(studentRoutes, { prefix: '/students' });
      await v1.register(parentRoutes, { prefix: '/parents' });
      await v1.register(groupRoutes, { prefix: '/groups' });
      await v1.register(sessionRoutes, { prefix: '/sessions' });
      await v1.register(attendanceRoutes, { prefix: '/attendance' });
      await v1.register(curriculumRoutes, { prefix: '/curriculum' });
      await v1.register(lessonRoutes, { prefix: '/lessons' });
      await v1.register(taskRoutes, { prefix: '/tasks' });
      await v1.register(submissionRoutes, { prefix: '/submissions' });
      await v1.register(examRoutes, { prefix: '/exams' });
      await v1.register(gamificationRoutes, { prefix: '/gamification' });
      await v1.register(paymentRoutes, { prefix: '/payments' });
      await v1.register(notificationRoutes, { prefix: '/notifications' });
      await v1.register(auditRoutes, { prefix: '/audit-logs' });
      await v1.register(dashboardRoutes, { prefix: '/dashboard' });
      await v1.register(registrationRoutes);
    },
    { prefix: '/api/v1' }
  );

  return app;
}

let serverlessAppInstance: any = null;

export default async function handler(req: any, res: any) {
  if (!serverlessAppInstance) {
    serverlessAppInstance = await buildApp();
    await serverlessAppInstance.ready();
  }
  serverlessAppInstance.server.emit('request', req, res);
}

