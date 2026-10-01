import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { getOrCreateCanonicalPlan, CANONICAL_PLAN_CODE } from '../src/modules/billing/billing.service.js';

describe('Phase 8: Admin Billing Operations, Plan CRUD & Hybrid Restriction', () => {
  let app: FastifyInstance;
  let adminToken: string;

  let hybridStudentId: string;
  let hybridStudentToken: string;
  let hybridUserEmail: string;

  let onlineStudentId: string;
  let onlineStudentToken: string;

  let unselectedStudentId: string;

  let canonicalPlan: any;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
    canonicalPlan = await getOrCreateCanonicalPlan();

    // 1. Create HYBRID student
    hybridUserEmail = `admin_ops_hybrid_${Date.now()}@codek.local`;
    const regHybrid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'HybridOps',
        lastName: 'Student',
        email: hybridUserEmail,
        password: 'Password@123'
      }
    });
    const hybridUserId = regHybrid.json().data.userId;
    const hybridOtp = regHybrid.json().data.devOtp;

    const vHybrid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: hybridUserId, otpCode: hybridOtp }
    });
    hybridStudentToken = vHybrid.json().data.accessToken;
    hybridStudentId = vHybrid.json().data.user.student.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${hybridStudentToken}` },
      payload: { mode: 'HYBRID' }
    });

    // 2. Create ONLINE student
    const onlineEmail = `admin_ops_online_${Date.now()}@codek.local`;
    const regOnline = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'OnlineOps',
        lastName: 'Student',
        email: onlineEmail,
        password: 'Password@123'
      }
    });
    const onlineUserId = regOnline.json().data.userId;
    const onlineOtp = regOnline.json().data.devOtp;

    const vOnline = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: onlineUserId, otpCode: onlineOtp }
    });
    onlineStudentToken = vOnline.json().data.accessToken;
    onlineStudentId = vOnline.json().data.user.student.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${onlineStudentToken}` },
      payload: { mode: 'ONLINE' }
    });

    // 3. Create UNSELECTED student (verified email, but no learning mode selected yet)
    const unselectedEmail = `admin_ops_unsel_${Date.now()}@codek.local`;
    const regUnsel = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'UnselectedOps',
        lastName: 'Student',
        email: unselectedEmail,
        password: 'Password@123'
      }
    });
    const unselUserId = regUnsel.json().data.userId;
    const unselOtp = regUnsel.json().data.devOtp;

    const vUnsel = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: unselUserId, otpCode: unselOtp }
    });
    unselectedStudentId = vUnsel.json().data.user.student.id;
  });

  // ─── 1. Manual Payment Restrictions & Invariants ────────────────

  it('1. POST /billing/admin/manual-record rejects ONLINE student with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-record',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { studentId: onlineStudentId }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/Hybrid/i);
  });

  it('2. POST /billing/admin/manual-record rejects student with learningModeSelected = false with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-record',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { studentId: unselectedStudentId }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/Hybrid/i);
  });

  it('3. POST /billing/admin/manual-record records payment for HYBRID student with provider=MANUAL', async () => {
    const idempotencyKey = `manual_test_${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-record',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: hybridStudentId,
        notes: 'Paid 250 EGP at reception',
        idempotencyKey
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.transaction.status).toBe('PAID');
    expect(body.data.transaction.provider).toBe('MANUAL');
    expect(body.data.transaction.amount).toBe(250);
    expect(body.data.subscription.status).toBe('ACTIVE');

    // Duplicate idempotency check
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-record',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: hybridStudentId,
        notes: 'Duplicate click',
        idempotencyKey
      }
    });
    expect(dupRes.statusCode).toBe(201);
    expect(dupRes.json().data.isDuplicate).toBe(true);
  });

  // ─── 2. Admin Transactions Search, Filters & Server Pagination ────

  it('4. GET /billing/admin/transactions returns proper pagination object', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/admin/transactions?page=1&pageSize=10',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);
    expect(typeof body.pagination.total).toBe('number');
    expect(typeof body.pagination.totalPages).toBe('number');
  });

  it('5. GET /billing/admin/transactions searches by student name and email', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/billing/admin/transactions?search=HybridOps`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].student.user.firstName).toBe('HybridOps');
  });

  it('6. GET /billing/admin/transactions filters by learningMode=HYBRID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/billing/admin/transactions?learningMode=HYBRID`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const txn of body.data) {
      expect(txn.student.attendanceRequired).toBe(true);
      expect(txn.student.learningModeSelected).toBe(true);
    }
  });

  it('7. GET /billing/admin/transactions filters by provider=MANUAL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/billing/admin/transactions?provider=MANUAL`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const txn of body.data) {
      expect(txn.provider.toUpperCase()).toBe('MANUAL');
    }
  });

  // ─── 3. Subscription Plan CRUD & Structured Benefits ───────────

  let createdPlanId: string;

  it('8. Admin can create a plan with structured benefits and icons', async () => {
    const planCode = `CUSTOM_PLAN_${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/plans',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Custom Semester Track',
        code: planCode,
        description: 'Full semester access with personal mentor',
        price: 750,
        currency: 'EGP',
        billingInterval: 'QUARTERLY',
        isActive: true,
        features: [
          { id: 'b1', textAr: 'وصول لجميع المسارات', textEn: 'All Tracks Access', icon: 'check', sortOrder: 0 },
          { id: 'b2', textAr: 'مشاريع عملية متقدمة', textEn: 'Advanced Practical Projects', icon: 'code', sortOrder: 1 },
          { id: 'b3', textAr: 'جلسات كود حية ومراجعة', textEn: 'Live Code Reviews', icon: 'video', sortOrder: 2 }
        ]
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.code).toBe(planCode);
    expect(body.data.features.length).toBe(3);
    expect(body.data.features[1].icon).toBe('code');
    createdPlanId = body.data.id;
  });

  it('9. Admin can update plan and reorder structured benefits', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/billing/admin/plans/${createdPlanId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        price: 800,
        features: [
          { id: 'b3', textAr: 'جلسات كود حية ومراجعة', textEn: 'Live Code Reviews', icon: 'video', sortOrder: 0 },
          { id: 'b1', textAr: 'وصول لجميع المسارات', textEn: 'All Tracks Access', icon: 'check', sortOrder: 1 }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.price).toBe(800);
    expect(body.data.features.length).toBe(2);
    expect(body.data.features[0].id).toBe('b3');
  });

  it('10. Admin cannot delete canonical CODEK_MONTHLY plan', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/billing/admin/plans/${canonicalPlan.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/canonical/i);
  });

  it('11. Plan without subscriptions is cleanly deleted', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/billing/admin/plans/${createdPlanId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);

    const check = await prisma.subscriptionPlan.findUnique({
      where: { id: createdPlanId }
    });
    expect(check).toBeNull();
  });

  it('12. Plan with historical subscriptions is soft-deactivated (isActive=false) rather than hard deleted', async () => {
    // Create a plan and subscribe a student to it
    const planCode2 = `HISTORICAL_${Date.now()}`;
    const pRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/plans',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Historical Plan',
        code: planCode2,
        price: 300,
        currency: 'EGP',
        billingInterval: 'MONTHLY',
        isActive: true
      }
    });
    const plan2Id = pRes.json().data.id;

    // Create a subscription referencing this plan
    await prisma.subscription.create({
      data: {
        studentId: hybridStudentId,
        planId: plan2Id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Delete should soft-deactivate
    const dRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/billing/admin/plans/${plan2Id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(dRes.statusCode).toBe(200);
    expect(dRes.json().data.deactivated).toBe(true);

    const check = await prisma.subscriptionPlan.findUnique({
      where: { id: plan2Id }
    });
    expect(check).toBeDefined();
    expect(check?.isActive).toBe(false);
  });

  it('13. Non-admin receives 403 on plan CRUD operations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/plans',
      headers: { authorization: `Bearer ${hybridStudentToken}` },
      payload: { name: 'Hacked', code: 'HACKED', price: 10 }
    });

    expect(res.statusCode).toBe(403);
  });
});
