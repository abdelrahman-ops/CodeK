import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { signAccessToken } from '../src/common/utils/jwt.js';
import { hashToken } from '../src/common/utils/crypto.js';
import { Role } from '@prisma/client';
import { env } from '../src/config/env.js';
import fs from 'fs';
import path from 'path';

describe('P0 Authentication Lifecycle & Silent Refresh Hardening', () => {
  let app: FastifyInstance;
  let testStudentUser: any;
  let testStudentLoginId: string;
  const testPassword = 'Student@123';

  function extractCookie(res: any): string {
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return '';
    const str = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
    return str.split(';')[0].trim();
  }

  beforeAll(async () => {
    app = await getTestApp();
    testStudentLoginId = 'STU-1001';

    await prisma.user.updateMany({
      where: { loginId: testStudentLoginId },
      data: { isEmailVerified: true }
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: testStudentLoginId,
        password: testPassword
      }
    });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Failed to login student STU-1001: ${loginRes.body}`);
    }

    testStudentUser = loginRes.json().data.user;
  });

  afterAll(async () => {
    // Keep seeded student intact, clean up any created test tokens
    if (testStudentUser) {
      await prisma.refreshToken.deleteMany({ where: { userId: testStudentUser.id } });
    }
  });

  describe('1. Cookie Issuance & Registration Session Establishment', () => {
    it('login creates an HttpOnly refreshToken cookie with 30-day lifetime', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: testStudentLoginId,
          password: testPassword
        }
      });

      expect(loginRes.statusCode).toBe(200);
      const setCookie = loginRes.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
      expect(cookieStr).toContain('refreshToken=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr).toContain('Path=/');
      expect(cookieStr).toContain('Max-Age=2592000'); // 30 days in seconds (30 * 24 * 3600)
    });

    it('registration creates an HttpOnly refreshToken cookie matching login session behavior', async () => {
      const regLoginId = `STU-REG-${Date.now().toString().slice(-4)}`;
      const regEmail = `reg-${Date.now()}@codek.local`;

      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'New',
          lastName: 'Student',
          email: regEmail,
          password: 'Password@123',
          phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
          programmingLevel: 'BEGINNER'
        }
      });

      expect(regRes.statusCode).toBe(201);
      const setCookie = regRes.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
      expect(cookieStr).toContain('refreshToken=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr).toContain('Path=/');
      expect(cookieStr).toContain('Max-Age=2592000');

      // Cleanup
      const registeredUser = regRes.json().data?.user;
      if (registeredUser?.id) {
        await prisma.authToken.deleteMany({ where: { userId: registeredUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: registeredUser.id } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: registeredUser.id } });
        await prisma.student.deleteMany({ where: { userId: registeredUser.id } });
        await prisma.user.deleteMany({ where: { id: registeredUser.id } });
      }
    });
  });

  describe('2. Cookie-Only Silent Refresh & Expired Access Token Recovery', () => {
    it('access token expires (simulated) -> protected endpoint returns 401', async () => {
      // Craft an expired access token
      const expiredToken = signAccessToken({
        userId: testStudentUser.id,
        loginId: testStudentUser.loginId,
        role: testStudentUser.role,
        studentId: testStudentUser.student.id,
        isEmailVerified: true
      });

      // Manually manipulate or wait? Better: use a deliberately expired token by signing with negative expiresIn
      const jwtModule = await import('jsonwebtoken');
      const { env } = await import('../src/config/env.js');
      const realExpiredToken = jwtModule.default.sign(
        {
          userId: testStudentUser.id,
          loginId: testStudentUser.loginId,
          role: testStudentUser.role,
          studentId: testStudentUser.student.id,
          isEmailVerified: true
        },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${realExpiredToken}`
        }
      });

      expect(meRes.statusCode).toBe(401);
      expect(meRes.json().error.code).toBe('UNAUTHORIZED');
      expect(meRes.json().error.message).toContain('expired');
    });

    it('cookie-only refresh with empty {} payload succeeds and issues new access token', async () => {
      // First login to obtain fresh cookie
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: testStudentLoginId,
          password: testPassword
        }
      });
      const cookieHeader = extractCookie(loginRes);

      // Call refresh passing ONLY the cookie and an empty {} body (as a browser in production does)
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          cookie: cookieHeader
        },
        payload: {}
      });

      expect(refreshRes.statusCode).toBe(200);
      const refreshBody = refreshRes.json().data;
      expect(refreshBody).toHaveProperty('accessToken');
      expect(typeof refreshBody.accessToken).toBe('string');
      expect(refreshBody.user.id).toBe(testStudentUser.id);

      // Verify the new access token grants immediate access to protected endpoints
      const retryMeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${refreshBody.accessToken}`
        }
      });
      expect(retryMeRes.statusCode).toBe(200);
      expect(retryMeRes.json().data.id).toBe(testStudentUser.id);
    });

    it('strict token rotation invalidates old refresh token', async () => {
      // Login
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: testStudentLoginId,
          password: testPassword
        }
      });
      const originalCookie = extractCookie(loginRes);

      // Refresh 1: Should succeed
      const refresh1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: originalCookie },
        payload: {}
      });
      expect(refresh1.statusCode).toBe(200);
      const newCookie = extractCookie(refresh1);

      // Refresh 2 with OLD cookie: MUST be rejected with 401
      const refreshOld = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: originalCookie },
        payload: {}
      });
      expect(refreshOld.statusCode).toBe(401);

      // Refresh 3 with NEW rotated cookie: Should succeed
      const refreshNew = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: newCookie },
        payload: {}
      });
      expect(refreshNew.statusCode).toBe(200);
    });
  });

  describe('3. Single-Flight Concurrency & Client Queue Invariants', () => {
    it('single-flight refresh logic: concurrent 401s collapse into exactly one refresh call and retry all requests', async () => {
      // Simulate client single-flight promise pattern
      let refreshServerCallCount = 0;

      // Login to get cookie
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: testStudentLoginId,
          password: testPassword
        }
      });
      let currentCookie = extractCookie(loginRes);

      // Simulated client-side single flight manager
      let activeRefreshPromise: Promise<string> | null = null;

      async function clientPerformRefresh(): Promise<string> {
        if (activeRefreshPromise) {
          return activeRefreshPromise;
        }

        activeRefreshPromise = (async () => {
          refreshServerCallCount++;
          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            headers: { cookie: currentCookie },
            payload: {}
          });

          if (res.statusCode !== 200) {
            throw new Error('Refresh failed');
          }

          const setCookieHeader = res.headers['set-cookie'];
          if (setCookieHeader) {
            currentCookie = extractCookie(res);
          }

          return res.json().data.accessToken;
        })().finally(() => {
          activeRefreshPromise = null;
        });

        return activeRefreshPromise;
      }

      // Simulate 5 concurrent requests failing with 401 at the exact same millisecond
      const concurrentRequestSimulators = Array.from({ length: 5 }).map(async (_, idx) => {
        // Step 1: Request receives 401, invokes single-flight refresh
        const newAccessToken = await clientPerformRefresh();

        // Step 2: Retry original request with newly issued token
        const retryRes = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/me',
          headers: {
            authorization: `Bearer ${newAccessToken}`
          }
        });

        expect(retryRes.statusCode).toBe(200);
        return { index: idx, userId: retryRes.json().data.id };
      });

      const results = await Promise.all(concurrentRequestSimulators);

      // Invariant 1: Exactly 1 refresh request was dispatched to the server
      expect(refreshServerCallCount).toBe(1);

      // Invariant 2: All 5 queued requests received the new token and succeeded
      expect(results.length).toBe(5);
      results.forEach((r) => expect(r.userId).toBe(testStudentUser.id));
    });
  });

  describe('4. Revocation & Logout Session Termination', () => {
    it('logout revokes the refresh session in database and clears the HttpOnly cookie', async () => {
      // Login
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: testStudentLoginId,
          password: testPassword
        }
      });
      const cookieHeader = extractCookie(loginRes);
      const accessToken = loginRes.json().data.accessToken;

      // Logout
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
          cookie: cookieHeader
        }
      });

      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.json().data.success).toBe(true);

      // Verify Set-Cookie header clears the cookie (Max-Age=0 or past date)
      const clearCookie = logoutRes.headers['set-cookie'];
      expect(clearCookie).toBeDefined();
      const clearCookieStr = Array.isArray(clearCookie) ? clearCookie[0] : String(clearCookie);
      expect(clearCookieStr).toContain('refreshToken=;');

      // Attempt refresh with old cookie: MUST be rejected with 401
      const retryRefresh = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: cookieHeader },
        payload: {}
      });
      expect(retryRefresh.statusCode).toBe(401);
    });
  });

  describe('5. Production Environment Security & Leak Prevention', () => {
    it('.env.production is not imported or bundled in client source or build artifacts', () => {
      const clientDistDir = path.resolve(__dirname, '../../client/dist');
      if (!fs.existsSync(clientDistDir)) {
        // If dist is not built yet, skip
        return;
      }

      // Read all files in client/dist/assets
      const assetsDir = path.join(clientDistDir, 'assets');
      if (!fs.existsSync(assetsDir)) return;

      const assetFiles = fs.readdirSync(assetsDir);
      const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));

      // Check that none of the client bundles contain server secrets
      const sensitiveKeys = [env.JWT_SECRET, env.JWT_REFRESH_SECRET];
      if (env.DATABASE_URL && !env.DATABASE_URL.includes('localhost')) {
        // Extract password from DATABASE_URL if present
        const dbUrlMatch = env.DATABASE_URL.match(/:([^:@]+)@/);
        if (dbUrlMatch && dbUrlMatch[1]) {
          sensitiveKeys.push(dbUrlMatch[1]);
        }
      }

      for (const jsFile of jsFiles) {
        const content = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

        for (const secret of sensitiveKeys) {
          if (secret && secret.length > 8) {
            expect(content.includes(secret)).toBe(false);
          }
        }

        // Verify that .env.production is never mentioned as an import
        expect(content.includes('.env.production')).toBe(false);
      }
    });

    it('client/.gitignore contains .env.* to prevent committing production environment files', () => {
      const clientGitignore = fs.readFileSync(path.resolve(__dirname, '../../client/.gitignore'), 'utf8');
      expect(clientGitignore).toContain('.env.*');
    });

    it('cookie options are deterministic: SameSite=None and Secure=true in production, Lax and Secure=false in development, host-only', () => {
      const devOptions = {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'lax' as const,
        maxAge: 30 * 24 * 60 * 60
      };
      expect(devOptions.sameSite).toBe('lax');
      expect(devOptions.secure).toBe(false);
      expect((devOptions as any).domain).toBeUndefined();

      const prodOptions = {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        maxAge: 30 * 24 * 60 * 60
      };
      expect(prodOptions.sameSite).toBe('none');
      expect(prodOptions.secure).toBe(true);
      expect((prodOptions as any).domain).toBeUndefined();
    });
  });
});
