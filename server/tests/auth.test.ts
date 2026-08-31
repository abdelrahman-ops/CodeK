import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

describe('Authentication & Onboarding Module', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  describe('Admin 2FA Authentication Flow', () => {
    let adminTempToken: string;
    let devOtp: string;

    it('Step 1: Admin login should challenge with 2FA and NOT issue an access token yet', async () => {
      const adminLoginId = env.ADMIN_LOGIN_ID || 'ADM-1106';
      const adminPassword = env.ADMIN_PASSWORD || 'AdminSuper110616010@here';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: adminLoginId,
          password: adminPassword
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.requires2FA).toBe(true);
      expect(body.data).toHaveProperty('tempToken');
      expect(body.data).toHaveProperty('emailMasked');
      expect(body.data.accessToken).toBeUndefined();

      adminTempToken = body.data.tempToken;
      devOtp = body.data.devOtp;
      expect(devOtp).toMatch(/^\d{6}$/);
    });

    it('Step 2: Should reject invalid OTP code during 2FA verification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-2fa',
        payload: {
          tempToken: adminTempToken,
          otpCode: '000000'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('Invalid verification code');
    });

    it('Step 2: Should successfully verify valid 6-digit OTP and issue session cookies & tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-2fa',
        payload: {
          tempToken: adminTempToken,
          otpCode: devOtp
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user.role).toBe('ADMIN');

      // Verify Set-Cookie header has HttpOnly refreshToken
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(String(cookies)).toContain('refreshToken=');
      expect(String(cookies).toLowerCase()).toContain('httponly');
    });

    it('Step 2: Should prevent OTP code reuse', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-2fa',
        payload: {
          tempToken: adminTempToken,
          otpCode: devOtp
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Student / Parent Simple Login', () => {
    it('should login student directly without 2FA requirement', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: 'STU-1001',
          password: 'Student@123'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.requires2FA).toBe(false);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data.user.role).toBe('STUDENT');
    });

    it('should login parent directly without 2FA requirement', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: 'PAR-2001',
          password: 'Parent@123'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.requires2FA).toBe(false);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data.user.role).toBe('PARENT');
    });

    it('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: 'STU-1001',
          password: 'WrongPassword'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Session Refresh & Token Rotation', () => {
    it('should rotate refreshToken and issue new tokens', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: 'STU-1001',
          password: 'Student@123'
        }
      });
      const { refreshToken } = loginRes.json().data;

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken }
      });

      expect(refreshRes.statusCode).toBe(200);
      expect(refreshRes.json().data).toHaveProperty('accessToken');
      expect(refreshRes.json().data).toHaveProperty('refreshToken');

      // Verify old refresh token is revoked
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken }
      });
      expect(reuseRes.statusCode).toBe(401);
    });
  });

  describe('Student Creation & Admin Password Reset', () => {
    let adminToken: string;

    beforeAll(async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginId: 'ADM-001', password: 'Admin@123456' }
      });
      const { tempToken, devOtp } = loginRes.json().data;
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-2fa',
        payload: { tempToken, otpCode: devOtp }
      });
      adminToken = verifyRes.json().data.accessToken;
    });

    it('should create a student, issue STU- login ID, and allow password change', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/users/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          firstName: 'Amr',
          lastName: 'Diab',
          phone: '01011223344',
          programmingLevel: 'BEGINNER'
        }
      });

      expect(createRes.statusCode).toBe(201);
      const newStudent = createRes.json().data;
      expect(newStudent.user.loginId).toMatch(/^STU-[A-Z0-9]{4}$/);
      expect(newStudent.temporaryPassword).toBeDefined();

      // Login as student
      const studentLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: newStudent.user.loginId,
          password: newStudent.temporaryPassword
        }
      });

      expect(studentLogin.statusCode).toBe(200);
      expect(studentLogin.json().data.mustChangePassword).toBe(true);
      const studentToken = studentLogin.json().data.accessToken;

      // Change password
      const changeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          currentPassword: newStudent.temporaryPassword,
          newPassword: 'SecureAmrPassword@2026'
        }
      });

      expect(changeRes.statusCode).toBe(200);
    });

    it('Admin can reset a student password via POST /students/:id/reset-password', async () => {
      // Create a test student
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/users/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          firstName: 'Reset',
          lastName: 'TestUser',
          programmingLevel: 'BEGINNER'
        }
      });
      const student = createRes.json().data.student;

      // Admin resets password
      const resetRes = await app.inject({
        method: 'POST',
        url: `/api/v1/students/${student.id}/reset-password`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(resetRes.statusCode).toBe(200);
      const resetData = resetRes.json().data;
      expect(resetData.temporaryPassword).toBeDefined();
      expect(resetData.loginId).toBe(createRes.json().data.user.loginId);

      // Student logs in with the new temp password
      const reLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: resetData.loginId,
          password: resetData.temporaryPassword
        }
      });

      expect(reLogin.statusCode).toBe(200);
      expect(reLogin.json().data.mustChangePassword).toBe(true);
    });
  });
});
