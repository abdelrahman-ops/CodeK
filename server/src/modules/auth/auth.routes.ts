import { FastifyInstance } from 'fastify';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  setupPasswordSchema,
  verifyAdminOtpSchema,
  resendAdminOtpSchema
} from './auth.schema.js';
import * as authService from './auth.service.js';
import { authenticate } from '../../common/middleware/auth.js';
import { verifyAccessToken } from '../../common/utils/jwt.js';
import { env } from '../../config/env.js';

const COOKIE_NAME = 'refreshToken';
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
};

export async function authRoutes(app: FastifyInstance) {
  // Login (Strict rate limit: 10 attempts per minute per IP)
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);

      if (!result.requires2FA && result.refreshToken) {
        reply.setCookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
      }

      return reply.send({ data: result });
    }
  );

  // Verify Admin 2FA OTP (Strict rate limit: 10 attempts per minute per IP)
  app.post(
    '/verify-2fa',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const input = verifyAdminOtpSchema.parse(request.body);
      const result = await authService.verifyAdminOtp(input);

      if (result.refreshToken) {
        reply.setCookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
      }

      return reply.send({ data: result });
    }
  );

  // Resend Admin 2FA OTP (Strict rate limit: 5 requests per 5 minutes per IP)
  app.post(
    '/resend-2fa',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '5 minutes'
        }
      }
    },
    async (request, reply) => {
      const input = resendAdminOtpSchema.parse(request.body);
      const result = await authService.resendAdminOtp(input);
      return reply.send({ data: result });
    }
  );

  // Refresh Token (Supports HttpOnly cookie or body fallback)
  app.post('/refresh', async (request, reply) => {
    const input = refreshSchema.parse(request.body || {});
    const rawRefreshToken = input.refreshToken || (request.cookies ? request.cookies[COOKIE_NAME] : undefined);

    if (!rawRefreshToken) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No refresh token provided'
        }
      });
    }

    const result = await authService.refresh(rawRefreshToken);

    if (result.refreshToken) {
      reply.setCookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    }

    return reply.send({ data: result });
  });

  // Logout
  app.post('/logout', async (request, reply) => {
    const body = request.body as { refreshToken?: string } | undefined;
    const cookieToken = request.cookies ? request.cookies[COOKIE_NAME] : undefined;
    const tokenToRevoke = body?.refreshToken || cookieToken;

    let userId: string | undefined;
    try {
      if (request.headers.authorization) {
        const authHeader = request.headers.authorization;
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const decoded = verifyAccessToken(token);
        userId = decoded?.userId;
      }
    } catch {
      // Ignore token verification errors during logout
    }

    await authService.logout(tokenToRevoke, userId);
    reply.clearCookie(COOKIE_NAME, { path: '/' });

    return reply.send({ data: { success: true } });
  });

  // Change Password (authenticated)
  app.post('/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    const result = await authService.changePassword(request.user!.userId, input);
    return reply.send({ data: result });
  });

  // One-time Setup Password (Strict rate limit: 5 attempts per 10 minutes)
  app.post(
    '/setup-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes'
        }
      }
    },
    async (request, reply) => {
      const input = setupPasswordSchema.parse(request.body);
      const result = await authService.setupPassword(input);

      if (result.refreshToken) {
        reply.setCookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
      }

      return reply.send({ data: result });
    }
  );

  // One-time Reset Password (Strict rate limit: 5 attempts per 10 minutes)
  app.post(
    '/reset-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes'
        }
      }
    },
    async (request, reply) => {
      const input = resetPasswordSchema.parse(request.body);
      const result = await authService.resetPassword(input);
      reply.clearCookie(COOKIE_NAME, { path: '/' });
      return reply.send({ data: result });
    }
  );

  // Get current user profile
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await authService.getMe(request.user!.userId);
    return reply.send({ data: result });
  });
}
