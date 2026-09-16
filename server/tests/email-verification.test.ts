import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { signAccessToken } from '../src/common/utils/jwt.js';
import { Role } from '@prisma/client';

describe('Phase 7: Account Email Verification', () => {
  let app: FastifyInstance;
  let registeredUserId: string;
  let registeredStudentId: string;
  let devOtp: string;
  let testEmail: string;
  let testPhone: string;
  const testPassword = 'Password@123';

  beforeAll(async () => {
    app = await getTestApp();
    const unique = Math.floor(10000000 + Math.random() * 90000000);
    testEmail = `verify_test_${unique}@codek.local`;
    testPhone = `011${unique}`;
  });

  // 1. Registration creates unverified account
  it('1. registration should create unverified account and return no session tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Verification',
        lastName: 'Student',
        email: testEmail,
        password: testPassword,
        phone: testPhone
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.requiresVerification).toBe(true);
    expect(body.data.userId).toBeDefined();
    expect(body.data.accessToken).toBeUndefined();
    expect(body.data.refreshToken).toBeUndefined();
    expect(body.data.devOtp).toBeDefined();

    registeredUserId = body.data.userId;
    devOtp = body.data.devOtp;

    // Verify DB state
    const userInDb = await prisma.user.findUnique({
      where: { id: registeredUserId },
      include: { student: true }
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb!.isEmailVerified).toBe(false);
    expect(userInDb!.student!.learningModeSelected).toBe(false);
    expect(userInDb!.student!.attendanceRequired).toBe(false);

    registeredStudentId = userInDb!.student!.id;
  });

  // 2. Registration does not create subscription or payment
  it('2. registration should NOT create subscription or payment transaction', async () => {
    const sub = await prisma.subscription.findFirst({
      where: { studentId: registeredStudentId }
    });
    expect(sub).toBeNull();

    const txn = await prisma.paymentTransaction.findFirst({
      where: { studentId: registeredStudentId }
    });
    expect(txn).toBeNull();
  });

  // 3. Unverified user token is blocked from protected Academy endpoints
  it('3. unverified user token should receive 403 Forbidden on protected endpoints', async () => {
    const unverifiedToken = signAccessToken({
      userId: registeredUserId,
      loginId: 'STU-TEST',
      role: Role.STUDENT,
      studentId: registeredStudentId,
      isEmailVerified: false
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${unverifiedToken}` }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/not verified/i);
  });

  // 4. Unverified user login returns requiresVerification without session
  it('4. login for unverified user should return requiresVerification without tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: testEmail,
        password: testPassword
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.requiresVerification).toBe(true);
    expect(body.data.userId).toBe(registeredUserId);
    expect(body.data.accessToken).toBeUndefined();
    expect(body.data.refreshToken).toBeUndefined();
  });

  // 5. Invalid OTP is rejected & attempts incremented
  it('5. invalid OTP should be rejected with attempt count tracked', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: registeredUserId,
        otpCode: '000000'
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/invalid/i);

    const token = await prisma.authToken.findFirst({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION' },
      orderBy: { createdAt: 'desc' }
    });
    expect(token!.attempts).toBe(1);
    expect(token!.status).toBe('PENDING');
  });

  // 6. Max 5 failed attempts invalidates the OTP
  it('6. five failed attempts should invalidate the OTP', async () => {
    for (let i = 2; i <= 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: {
          userId: registeredUserId,
          otpCode: '000000'
        }
      });
    }

    const token = await prisma.authToken.findFirst({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION' },
      orderBy: { createdAt: 'desc' }
    });
    expect(token!.attempts).toBe(5);
    expect(token!.status).toBe('INVALIDATED');

    // Even correct devOtp now fails
    const retryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: registeredUserId,
        otpCode: devOtp
      }
    });
    expect(retryRes.statusCode).toBe(400);
  });

  // 7. Resend cooldown is enforced
  it('7. resend within 60s cooldown should be rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { userId: registeredUserId }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/wait/i);
  });

  // 8. Resend after cooldown works and invalidates older OTPs
  it('8. resend after cooldown should issue new OTP and invalidate older OTPs', async () => {
    // Fast-forward created token timestamp beyond 60s
    await prisma.authToken.updateMany({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION' },
      data: { createdAt: new Date(Date.now() - 65 * 1000) }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { userId: registeredUserId }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.success).toBe(true);
    expect(body.data.devOtp).toBeDefined();

    devOtp = body.data.devOtp;

    // Check that there is only one PENDING token now
    const pendingTokens = await prisma.authToken.findMany({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION', status: 'PENDING' }
    });
    expect(pendingTokens.length).toBe(1);
  });

  // 9. Expired OTP is rejected
  it('9. expired OTP should be rejected', async () => {
    // Expire the token
    await prisma.authToken.updateMany({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION', status: 'PENDING' },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: registeredUserId,
        otpCode: devOtp
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/expired/i);
  });

  // 10. Valid OTP verifies account and issues session tokens
  it('10. valid OTP verifies account and returns full session', async () => {
    // Advance timestamp and request fresh code
    await prisma.authToken.updateMany({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION' },
      data: { createdAt: new Date(Date.now() - 65 * 1000) }
    });

    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { userId: registeredUserId }
    });
    const freshOtp = resendRes.json().data.devOtp;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: registeredUserId,
        otpCode: freshOtp
      }
    });

    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json();
    expect(body.data.user.isEmailVerified).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();

    // Verify DB state
    const userInDb = await prisma.user.findUnique({
      where: { id: registeredUserId }
    });
    expect(userInDb!.isEmailVerified).toBe(true);

    const tokenInDb = await prisma.authToken.findFirst({
      where: { userId: registeredUserId, type: 'EMAIL_VERIFICATION', status: 'VERIFIED' }
    });
    expect(tokenInDb).not.toBeNull();
    expect(tokenInDb!.usedAt).not.toBeNull();
  });

  // 11. OTP is single-use
  it('11. verified OTP cannot be reused', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: registeredUserId,
        otpCode: devOtp
      }
    });

    expect(res.statusCode).toBe(400);
  });

  // 12. Verified user logs in without re-challenge
  it('12. verified student logs in normally without verification challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: testEmail,
        password: testPassword
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.requiresVerification).toBeUndefined();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user.isEmailVerified).toBe(true);
  });

  // 13. Existing grandfathered users continue to log in without challenge
  it('13. grandfathered student STU-1001 logs in without verification challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        loginId: 'STU-1001',
        password: 'Student@123'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.requiresVerification).toBeUndefined();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user.isEmailVerified).toBe(true);
  });
});
