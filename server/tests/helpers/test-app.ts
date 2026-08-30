import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';

let app: FastifyInstance | null = null;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function loginAdmin(testApp: FastifyInstance): Promise<string> {
  const loginRes = await testApp.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      loginId: env.ADMIN_LOGIN_ID || 'ADM-001',
      password: env.ADMIN_PASSWORD || 'Admin@123456'
    }
  });

  const body = loginRes.json();
  if (body.data?.requires2FA && body.data?.tempToken) {
    const verifyRes = await testApp.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-2fa',
      payload: {
        tempToken: body.data.tempToken,
        otpCode: body.data.devOtp || '123456'
      }
    });
    return verifyRes.json().data.accessToken;
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
