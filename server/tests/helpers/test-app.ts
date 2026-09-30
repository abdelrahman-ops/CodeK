import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/prisma.js';
import { decryptForDelivery } from '../../src/utils/crypto-delivery.js';

let app: FastifyInstance | null = null;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function loginAdmin(testApp: FastifyInstance): Promise<string> {
  // Invalidate any existing pending OTP tokens for tests to avoid reuse with missing raw OTP
  let adminUser = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      adminUser = await prisma.user.findFirst({
        where: { loginId: env.ADMIN_LOGIN_ID || 'ADM-001' }
      });
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (adminUser) {
    await prisma.authToken.deleteMany({
      where: { userId: adminUser.id, type: 'ADMIN_LOGIN_OTP' }
    });
  }

  const loginRes = await testApp.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      loginId: env.ADMIN_LOGIN_ID || 'ADM-001',
      password: env.ADMIN_PASSWORD || 'Admin@123456'
    }
  });

  const body = loginRes.json();
  if (!body.data) {
    throw new Error(`loginAdmin failed at /login: status=${loginRes.statusCode}, body=${JSON.stringify(body)}`);
  }

  if (body.data?.requires2FA && body.data?.tempToken) {
    const otpRecord = await prisma.authToken.findFirst({
      where: { type: 'ADMIN_LOGIN_OTP' },
      orderBy: { createdAt: 'desc' }
    });
    let otpCode = body.data.devOtp;
    if (!otpCode && otpRecord?.encryptedToken) {
      try {
        otpCode = decryptForDelivery(otpRecord.encryptedToken);
      } catch {
        // fallback
      }
    }
    if (!otpCode) {
      otpCode = '123456';
    }
    const verifyRes = await testApp.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-2fa',
      payload: {
        tempToken: body.data.tempToken,
        otpCode
      }
    });
    const verifyBody = verifyRes.json();
    if (!verifyBody.data) {
      throw new Error(`loginAdmin failed at /verify-2fa: status=${verifyRes.statusCode}, body=${JSON.stringify(verifyBody)}`);
    }
    return verifyBody.data.accessToken;
  }

  return body.data.accessToken;
}

export async function loginStudent(testApp: FastifyInstance, loginId = 'STU-1001', password = 'Student@123'): Promise<string> {
  const loginRes = await testApp.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { loginId, password }
  });
  return loginRes.json().data.accessToken;
}

export async function loginParent(testApp: FastifyInstance, loginId = 'PAR-2001', password = 'Parent@123'): Promise<string> {
  const loginRes = await testApp.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { loginId, password }
  });
  return loginRes.json().data.accessToken;
}
