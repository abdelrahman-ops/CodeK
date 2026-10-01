import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';

describe('P1 Student Grade → Plan/Price Assignment Architecture', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it('resolves active 150 EGP plan when student registers with GRADE_1', async () => {
    const timestamp = Date.now();
    const email = `grade1_${timestamp}@codek.test`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Tamer',
        lastName: 'Hosny',
        email,
        password: 'Password123!',
        phone: `+2010${timestamp.toString().slice(-8)}`,
        grade: 'GRADE_1'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.user.student.grade).toBe('GRADE_1');
    expect(body.data.assignedPlan).toBeDefined();
    expect(body.data.assignedPlan.code).toBe('GRADE_1_MONTHLY');
    expect(body.data.assignedPlan.price).toBe(150);
    expect(body.data.assignedPlan.currency).toBe('EGP');

    // Verify subscription created in database with locked historical price
    const subscription = await prisma.subscription.findFirst({
      where: { studentId: body.data.user.student.id },
      include: { plan: true }
    });

    expect(subscription).toBeDefined();
    expect(subscription?.plan.code).toBe('GRADE_1_MONTHLY');
    expect(subscription?.plan.price).toBe(150);
    const meta = subscription?.metadata as any;
    expect(meta.assignedPrice).toBe(150);
    expect(meta.grade).toBe('GRADE_1');
  });

  it('resolves active 250 EGP plan when student registers with GRADE_2', async () => {
    const timestamp = Date.now();
    const email = `grade2_${timestamp}@codek.test`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Amr',
        lastName: 'Diab',
        email,
        password: 'Password123!',
        phone: `+2011${timestamp.toString().slice(-8)}`,
        grade: 'GRADE_2'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.user.student.grade).toBe('GRADE_2');
    expect(body.data.assignedPlan).toBeDefined();
    expect(body.data.assignedPlan.code).toBe('GRADE_2_MONTHLY');
    expect(body.data.assignedPlan.price).toBe(250);
  });

  it('rejects / ignores client-tampered price and strictly resolves server-side price from grade', async () => {
    const timestamp = Date.now();
    const email = `tamper_${timestamp}@codek.test`;

    // Malicious client attempting to inject price: 1 EGP
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Attacker',
        lastName: 'Hacker',
        email,
        password: 'Password123!',
        grade: 'GRADE_1',
        price: 1 // Attempted price manipulation
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    // Server authoritative price must be 150, NOT 1
    expect(body.data.assignedPlan.price).toBe(150);

    const subscription = await prisma.subscription.findFirst({
      where: { studentId: body.data.user.student.id },
      include: { plan: true }
    });

    expect(subscription?.plan.price).toBe(150);
    expect((subscription?.metadata as any).assignedPrice).toBe(150);
  });

  it('preserves historical subscription pricing when plan price changes in database', async () => {
    const timestamp = Date.now();
    const email = `history_${timestamp}@codek.test`;

    // 1. Register student under initial 150 EGP pricing
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Historical',
        lastName: 'Student',
        email,
        password: 'Password123!',
        grade: 'GRADE_1'
      }
    });

    expect(res.statusCode).toBe(201);
    const initialStudentId = res.json().data.user.student.id;

    // 2. Admin updates the plan price for GRADE_1_MONTHLY to 180 EGP in database
    await prisma.subscriptionPlan.update({
      where: { code: 'GRADE_1_MONTHLY' },
      data: { price: 180 }
    });

    // 3. Verify prior student's subscription metadata preserved the locked 150 EGP historical price
    const priorSub = await prisma.subscription.findFirst({
      where: { studentId: initialStudentId }
    });
    expect((priorSub?.metadata as any).assignedPrice).toBe(150);

    // 4. New student registering after price change receives new 180 EGP price
    const newTimestamp = Date.now();
    const newRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Future',
        lastName: 'Student',
        email: `future_${newTimestamp}@codek.test`,
        password: 'Password123!',
        grade: 'GRADE_1'
      }
    });

    expect(newRes.statusCode).toBe(201);
    expect(newRes.json().data.assignedPlan.price).toBe(180);

    // Revert plan price back to 150 for test suite cleanliness
    await prisma.subscriptionPlan.update({
      where: { code: 'GRADE_1_MONTHLY' },
      data: { price: 150 }
    });
  });

  it('exposes public GET /api/v1/billing/grade-plans returning active grade plans for UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/grade-plans'
    });

    expect(res.statusCode).toBe(200);
    const plans = res.json().data;
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThanOrEqual(3);

    const grade1 = plans.find((p: any) => p.code === 'GRADE_1_MONTHLY');
    expect(grade1).toBeDefined();
    expect(grade1.price).toBe(150);

    const grade2 = plans.find((p: any) => p.code === 'GRADE_2_MONTHLY');
    expect(grade2).toBeDefined();
    expect(grade2.price).toBe(250);
  });

  it('scopes GET /api/v1/access/plans to authenticated student grade and rejects cross-grade query', async () => {
    const timestamp = Date.now();
    const email = `plan_scope_${timestamp}@codek.test`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Scoped',
        lastName: 'Student',
        email,
        password: 'Password123!',
        phone: `+2012${timestamp.toString().slice(-8)}`,
        grade: 'GRADE_1'
      }
    });
    expect(regRes.statusCode).toBe(201);
    const regData = regRes.json().data;
    
    // Verify email to obtain accessToken
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: regData.userId,
        otpCode: regData.devOtp
      }
    });
    expect(verifyRes.statusCode).toBe(200);
    const token = verifyRes.json().data.accessToken;

    // Student calls /access/plans -> should only receive plans for GRADE_1
    const plansRes = await app.inject({
      method: 'GET',
      url: '/api/v1/access/plans',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(plansRes.statusCode).toBe(200);
    const studentPlans = plansRes.json().data;
    expect(studentPlans.length).toBeGreaterThanOrEqual(1);
    for (const p of studentPlans) {
      const pGrade = p.features?.grade || (p.code.startsWith('GRADE_1') ? 'GRADE_1' : p.code.startsWith('GRADE_2') ? 'GRADE_2' : 'GRADE_3');
      expect(pGrade).toBe('GRADE_1');
    }

    // Student attempts to query for a different grade -> 403 Forbidden
    const crossRes = await app.inject({
      method: 'GET',
      url: '/api/v1/access/plans?grade=GRADE_2',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(crossRes.statusCode).toBe(403);
  });

  it('rejects checkout when student attempts to purchase plan for different grade', async () => {
    const timestamp = Date.now();
    const email = `checkout_cross_${timestamp}@codek.test`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'CrossGrade',
        lastName: 'Shopper',
        email,
        password: 'Password123!',
        phone: `+2015${timestamp.toString().slice(-8)}`,
        grade: 'GRADE_1'
      }
    });
    expect(regRes.statusCode).toBe(201);
    const regData = regRes.json().data;

    // Verify email to obtain accessToken
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: regData.userId,
        otpCode: regData.devOtp
      }
    });
    expect(verifyRes.statusCode).toBe(200);
    const token = verifyRes.json().data.accessToken;

    // GRADE_1 student tries to checkout GRADE_2 plan
    const crossCheckout = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: { planId: 'GRADE_2_MONTHLY', paymentMethod: 'VODAFONE_CASH' }
    });
    expect(crossCheckout.statusCode).toBe(400);

    // GRADE_1 student checkouts GRADE_1 plan -> succeeds and returns manualPayment payload
    const validCheckout = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: { planId: 'GRADE_1_MONTHLY', paymentMethod: 'VODAFONE_CASH' }
    });
    expect(validCheckout.statusCode).toBe(201);
    const checkoutBody = validCheckout.json().data;
    expect(checkoutBody.manualPayment).toBeDefined();
    expect(checkoutBody.manualPayment.receivingAccount).toBeDefined();
    expect(checkoutBody.amount).toBe(150);
  });
});
