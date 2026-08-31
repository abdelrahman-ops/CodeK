import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';
import { emailService } from '../src/services/email/email.service.js';
import { env } from '../src/config/env.js';

describe('Admin 2FA OTP Authentication & Session Lifecycle Module', () => {
  let app: FastifyInstance;
  let sendEmailSpy: any;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await prisma.authToken.deleteMany();
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');
    sendEmailSpy.mockClear();
  });

  it('Test 1 — Normal login creates exactly ONE OTP challenge and sends ONE email', async () => {
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Perform Admin Login
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.requires2FA).toBe(true);
    expect(body.tempToken).toBeDefined();

    // Verify exactly ONE email was dispatched
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);

    // Verify ONE active PENDING AuthToken in DB
    const adminUser = await prisma.user.findFirst({
      where: { loginId: (env.ADMIN_LOGIN_ID || 'ADM-1106').toUpperCase() }
    });
    expect(adminUser).not.toBeNull();

    const pendingTokens = await prisma.authToken.findMany({
      where: {
        userId: adminUser!.id,
        type: 'ADMIN_LOGIN_OTP',
        status: 'PENDING'
      }
    });
    expect(pendingTokens.length).toBe(1);
  });

  it('Test 2 — Verify OTP authenticates Admin session and sends ZERO additional emails', async () => {
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Step 1: Login to get tempToken & devOtp
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });
    const { tempToken, devOtp } = loginRes.json().data;
    expect(tempToken).toBeDefined();
    expect(devOtp).toBeDefined();
    sendEmailSpy.mockClear();

    // Step 2: Verify OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-2fa',
      payload: {
        tempToken,
        otpCode: devOtp
      }
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json().data;
    expect(verifyBody).toHaveProperty('accessToken');
    expect(verifyBody).toHaveProperty('refreshToken');
    expect(verifyBody.user.role).toBe('ADMIN');

    // ZERO emails sent during verification
    expect(sendEmailSpy).toHaveBeenCalledTimes(0);
  });

  it('Test 3 — Dashboard & resource fetching produces ZERO OTP challenges and ZERO emails', async () => {
    const token = await loginAdmin(app);
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Fetch /auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(meRes.statusCode).toBe(200);

    // Fetch /dashboard/admin
    const dashRes = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/admin',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(dashRes.statusCode).toBe(200);

    // Fetch /students
    const studentsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/students',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(studentsRes.statusCode).toBe(200);

    // Fetch /groups
    const groupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(groupsRes.statusCode).toBe(200);

    // Fetch /notifications
    const notifRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(notifRes.statusCode).toBe(200);

    // Assert ZERO email calls
    expect(sendEmailSpy).toHaveBeenCalledTimes(0);
  });

  it('Test 4 — Token refresh executes silently with ZERO OTP emails', async () => {
    // Login & verify to get a fresh refresh token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });

    const { tempToken, devOtp } = loginRes.json().data;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-2fa',
      payload: { tempToken, otpCode: devOtp }
    });

    const { refreshToken: rawRefreshToken } = verifyRes.json().data;
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Call /auth/refresh
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: rawRefreshToken }
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshData = refreshRes.json().data;
    expect(refreshData).toHaveProperty('accessToken');
    expect(refreshData).toHaveProperty('refreshToken');

    // ZERO OTP emails generated during token refresh
    expect(sendEmailSpy).toHaveBeenCalledTimes(0);
  });

  it('Test 5 — Duplicate OTP login requests within 30s reuse active challenge without sending multiple emails', async () => {
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Request 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });

    expect(res1.statusCode).toBe(200);
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);

    // Immediate Request 2 (<30s cooldown)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.json().data.requires2FA).toBe(true);

    // Email count MUST remain 1 (no duplicate email dispatched)
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);

    // Immediate Request 3
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });

    expect(res3.statusCode).toBe(200);
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 6 — Resend OTP within 30s cooldown is rejected without sending emails', async () => {
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Step 1: Initiate login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
        password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
      }
    });

    const { tempToken } = loginRes.json().data;
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);

    // Step 2: Attempt resend immediately (<30s cooldown)
    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-2fa',
      payload: { tempToken }
    });

    expect(resendRes.statusCode).toBe(400);
    expect(resendRes.json().error.message).toContain('wait');

    // Email count MUST remain 1
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 7 — Page refresh / session check after login generates ZERO OTP emails', async () => {
    const token = await loginAdmin(app);
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Simulate multiple F5 page refreshes (/auth/me calls)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res.statusCode).toBe(200);
    }

    // ZERO emails generated
    expect(sendEmailSpy).toHaveBeenCalledTimes(0);
  });

  it('Test 8 — React StrictMode / double-mounting simulation produces ZERO duplicate emails', async () => {
    sendEmailSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');

    // Simulate React StrictMode mounting component twice with same parameters
    const [mount1, mount2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
          password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
        }
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
          password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
        }
      })
    ]);

    expect(mount1.statusCode).toBe(200);
    expect(mount2.statusCode).toBe(200);

    // Exactly 1 email sent due to idempotency lock
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });
});
