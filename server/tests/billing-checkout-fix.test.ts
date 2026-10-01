import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { getOrCreateCanonicalPlan, CANONICAL_PLAN_CODE } from '../src/modules/billing/billing.service.js';

describe('Phase 8: Billing Checkout PlanId Resolution & Robustness', () => {
  let app: FastifyInstance;
  let studentToken: string;
  let studentId: string;
  let canonicalPlan: any;

  beforeAll(async () => {
    app = await getTestApp();
    canonicalPlan = await getOrCreateCanonicalPlan();

    // Register & verify a test student
    const email = `checkout_fix_${Date.now()}@codek.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Checkout',
        lastName: 'Tester',
        email,
        password: 'Password@123'
      }
    });
    const userId = regRes.json().data.userId;
    const otp = regRes.json().data.devOtp;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId, otpCode: otp }
    });
    studentToken = verifyRes.json().data.accessToken;
    studentId = verifyRes.json().data.user.student.id;

    // Select ONLINE mode
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { mode: 'ONLINE' }
    });
  });

  it('1. POST /billing/checkout with empty object {} resolves canonical plan without error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {}
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.transactionId).toBeDefined();
    expect(body.data.clientSecret).toBeDefined();

    // Verify transaction created with canonical plan ID
    const txn = await prisma.paymentTransaction.findUnique({
      where: { id: body.data.transactionId }
    });
    expect(txn).toBeDefined();
    expect(txn?.planId).toBe(canonicalPlan.id);
    expect(txn?.amount).toBe(250);
  });

  it('2. POST /billing/checkout with { planId: "CODEK_MONTHLY" } resolves without "Invalid uuid" error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { planId: 'CODEK_MONTHLY' }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.transactionId).toBeDefined();

    const txn = await prisma.paymentTransaction.findUnique({
      where: { id: body.data.transactionId }
    });
    expect(txn?.planId).toBe(canonicalPlan.id);
  });

  it('3. POST /billing/checkout with canonical plan UUID succeeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { planId: canonicalPlan.id }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.transactionId).toBeDefined();
  });
});
