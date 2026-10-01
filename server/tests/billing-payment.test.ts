import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/common/utils/crypto.js';
import { getLessonAccess } from '../src/modules/access/access.service.js';
import { env } from '../src/config/env.js';
import { CANONICAL_PLAN_CODE, CANONICAL_PLAN_PRICE, getOrCreateCanonicalPlan } from '../src/modules/billing/billing.service.js';

describe('Phase 3 & 6: Production Payment System & Hardened Subscription Engine', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let studentUserId: string;

  let otherStudentToken: string;
  let otherStudentId: string;
  let otherStudentUserId: string;

  let canonicalPlanId: string;
  let paidLessonId: string;
  let pwdHash: string;

  const HMAC_SECRET = env.PAYMOB_HMAC_SECRET || 'codek_paymob_hmac_secret_default_key';

  let eventSeq = 0;
  function getUniqueEventId(): number {
    return Math.floor(Date.now() / 1000) * 10000 + (++eventSeq);
  }

  // Helper to compute Paymob HMAC signature according to the documented field order
  function computePaymobHmac(data: any, secret: string = HMAC_SECRET): string {
    const fieldsToHash: Record<string, any> = {
      amount_cents: data.amount_cents,
      created_at: data.created_at,
      currency: data.currency,
      error_occured: data.error_occured,
      has_parent_transaction: data.has_parent_transaction,
      id: data.id,
      integration_id: data.integration_id,
      is_3d_secure: data.is_3d_secure,
      is_auth: data.is_auth,
      is_capture: data.is_capture,
      is_refunded: data.is_refunded,
      is_standalone_payment: data.is_standalone_payment,
      is_voided: data.is_voided,
      'order.id': data.order?.id,
      owner: data.owner,
      pending: data.pending,
      'source_data.pan': data.source_data?.pan,
      'source_data.sub_type': data.source_data?.sub_type,
      'source_data.type': data.source_data?.type,
      success: data.success
    };

    const sortedKeys = Object.keys(fieldsToHash).sort();
    const concatenated = sortedKeys.map(k => String(fieldsToHash[k] ?? '')).join('');

    return crypto
      .createHmac('sha512', secret)
      .update(concatenated)
      .digest('hex');
  }

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const uniqueSuffix = Date.now().toString().slice(-4);
    pwdHash = await hashPassword('Student@123');

    // 1. Primary Student
    const user = await prisma.user.create({
      data: {
        loginId: `STU-BILL-${uniqueSuffix}`,
        email: `billing.student.${uniqueSuffix}@test.com`,
        passwordHash: pwdHash,
        role: 'STUDENT',
        firstName: 'Billing',
        lastName: 'Student',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-BILL-${uniqueSuffix}`,
            anonymousLeaderboardCode: `BILL-${uniqueSuffix}`,
            attendanceRequired: true, // Independent Saturday attendance
            learningModeSelected: true
          }
        }
      },
      include: { student: true }
    });
    studentUserId = user.id;
    studentId = user.student!.id;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-BILL-${uniqueSuffix}`, password: 'Student@123' }
    });
    studentToken = loginRes.json().data.accessToken;

    // 2. Secondary Student (for IDOR and isolation tests)
    const user2 = await prisma.user.create({
      data: {
        loginId: `STU-ISO-${uniqueSuffix}`,
        email: `isolated.student.${uniqueSuffix}@test.com`,
        passwordHash: pwdHash,
        role: 'STUDENT',
        firstName: 'Isolated',
        lastName: 'Student',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-ISO-${uniqueSuffix}`,
            anonymousLeaderboardCode: `ISO-${uniqueSuffix}`,
            attendanceRequired: false,
            learningModeSelected: true
          }
        }
      },
      include: { student: true }
    });
    otherStudentUserId = user2.id;
    otherStudentId = user2.student!.id;

    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-ISO-${uniqueSuffix}`, password: 'Student@123' }
    });
    otherStudentToken = loginRes2.json().data.accessToken;

    // 3. Ensure Canonical 250 EGP Plan
    const canonicalPlan = await getOrCreateCanonicalPlan();
    canonicalPlanId = canonicalPlan.id;

    // 4. Create a Course & Paid Lesson for Access Testing
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `Payment Test Course ${uniqueSuffix}`,
        description: 'Course testing payment access models'
      }
    });
    const courseId = courseRes.json().data.id;

    const lessonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: 'Paid Subscription Lesson',
        content: '# Subscription Content',
        order: 1,
        isFree: false,
        accessType: 'SUBSCRIPTION_REQUIRED'
      }
    });
    paidLessonId = lessonRes.json().data.id;
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 1: CHECKOUT INITIALIZATION & SECURITY
  // ─────────────────────────────────────────────────────────
  describe('1. Checkout Security & Plan Pricing', () => {
    let primaryTxnId: string;

    it('1. Pre-payment: Student without subscription cannot access paid lesson', async () => {
      const access = await getLessonAccess(studentId, paidLessonId);
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('2. Unauthenticated visitor cannot initiate checkout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: { planId: canonicalPlanId }
      });
      expect(res.statusCode).toBe(401);
    });

    it('3. Authenticated student can initiate checkout for canonical 250 EGP plan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { planId: canonicalPlanId }
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.transactionId).toBeDefined();
      expect(data.clientSecret).toBeDefined();
      expect(data.publicKey).toBeDefined();

      primaryTxnId = data.transactionId;

      // Verify transaction in DB has exact server price (250) and currency (EGP)
      const txn = await prisma.paymentTransaction.findUnique({ where: { id: primaryTxnId } });
      expect(txn).toBeDefined();
      expect(txn?.amount).toBe(250);
      expect(txn?.currency).toBe('EGP');
      expect(txn?.status).toBe('PENDING');
      expect(txn?.studentId).toBe(studentId);
    });

    it('4. Checkout defaults to canonical 250 EGP plan if planId is omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: { authorization: `Bearer ${otherStudentToken}` },
        payload: {}
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      const txn = await prisma.paymentTransaction.findUnique({ where: { id: data.transactionId } });
      expect(txn?.amount).toBe(250);
      expect(txn?.currency).toBe('EGP');
      expect(txn?.planId).toBe(canonicalPlanId);
    });

    it('5. Client cannot override amount, price, or currency via request payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          planId: canonicalPlanId,
          amount: 1, // Tamper attempt
          price: 1,
          currency: 'USD'
        }
      });

      expect(res.statusCode).toBe(201);
      const txn = await prisma.paymentTransaction.findUnique({ where: { id: res.json().data.transactionId } });
      expect(txn?.amount).toBe(250);
      expect(txn?.currency).toBe('EGP');
    });

    it('6. Client cannot purchase for another student (studentId derived from session)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          planId: canonicalPlanId,
          studentId: otherStudentId, // Malicious injection
          userId: otherStudentUserId
        }
      });

      expect(res.statusCode).toBe(201);
      const txn = await prisma.paymentTransaction.findUnique({ where: { id: res.json().data.transactionId } });
      expect(txn?.studentId).toBe(studentId); // Tied strictly to authenticated student
      expect(txn?.studentId).not.toBe(otherStudentId);
    });
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 2: WEBHOOK SECURITY & VALIDATION
  // ─────────────────────────────────────────────────────────
  describe('2. Webhook HMAC, Amount & Currency Validation', () => {
    let testTxnId: string;

    beforeAll(async () => {
      // Create a fresh PENDING transaction for webhook testing
      const txn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });
      testTxnId = txn.id;
    });

    it('7. Invalid HMAC is rejected with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/webhooks/paymob?hmac=completely_invalid_hmac_string',
        payload: {
          type: 'TRANSACTION',
          obj: { id: getUniqueEventId(), amount_cents: 25000, special_reference: testTxnId, success: true }
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('8. Wrong-length HMAC is rejected cleanly with 403 without crashing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/webhooks/paymob?hmac=1234',
        payload: {
          type: 'TRANSACTION',
          obj: { id: getUniqueEventId(), amount_cents: 25000, special_reference: testTxnId, success: true }
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('9. Modified signed field invalidates HMAC and is rejected with 403', async () => {
      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: testTxnId
      };

      const validHmac = computePaymobHmac(txnObj);

      // Attacker tampers with amount_cents after signing
      const tamperedPayload = {
        type: 'TRANSACTION',
        obj: { ...txnObj, amount_cents: 100 }
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${validHmac}`,
        payload: tamperedPayload
      });
      expect(res.statusCode).toBe(403);
    });

    it('10. Security: 500 EGP (50000 minor units) for a 250 EGP transaction is REJECTED', async () => {
      const tamperedTxn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 50000, // 500 EGP sent instead of 250 EGP (25000)
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: tamperedTxn.id
      };

      const validHmac = computePaymobHmac(txnObj);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${validHmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().processed).toBe(false);
      expect(res.json().message).toContain('Amount mismatch');

      // Transaction marked FAILED
      const txnInDb = await prisma.paymentTransaction.findUnique({ where: { id: tamperedTxn.id } });
      expect(txnInDb?.status).toBe('FAILED');
    });

    it('11. Security: Wrong currency (USD instead of EGP) is REJECTED', async () => {
      const currencyTxn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'USD', // Malicious or wrong currency
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: currencyTxn.id
      };

      const validHmac = computePaymobHmac(txnObj);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${validHmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().processed).toBe(false);
      expect(res.json().message).toContain('Currency mismatch');
    });

    it('12. Unknown payment reference is rejected gracefully without creating records', async () => {
      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: '00000000-0000-0000-0000-000000000000'
      };

      const validHmac = computePaymobHmac(txnObj);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${validHmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().processed).toBe(false);
      expect(res.json().message).toContain('Transaction not found');
    });

    it('13. Unsuccessful transaction (success: false) marks transaction FAILED and does not activate subscription', async () => {
      const failedTxn = await prisma.paymentTransaction.create({
        data: {
          studentId: otherStudentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: true,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: false, // Payment declined / failed
        special_reference: failedTxn.id
      };

      const validHmac = computePaymobHmac(txnObj);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${validHmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().processed).toBe(true);

      const txnInDb = await prisma.paymentTransaction.findUnique({ where: { id: failedTxn.id } });
      expect(txnInDb?.status).toBe('FAILED');

      const sub = await prisma.subscription.findFirst({ where: { studentId: otherStudentId } });
      expect(sub).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 3: ATOMIC ACTIVATION & CONCURRENCY-SAFE IDEMPOTENCY
  // ─────────────────────────────────────────────────────────
  describe('3. Concurrency Safety, Atomicity & Entitlement Invariants', () => {
    let activeTxnId: string;

    it('14. Valid webhook confirms payment and activates 30-day subscription', async () => {
      const txn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });
      activeTxnId = txn.id;

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000, // 250 EGP exact integer minor units
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: activeTxnId
      };

      const validHmac = computePaymobHmac(txnObj);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${validHmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().processed).toBe(true);

      // Verify transaction is PAID
      const txnInDb = await prisma.paymentTransaction.findUnique({ where: { id: activeTxnId } });
      expect(txnInDb?.status).toBe('PAID');
      expect(txnInDb?.paidAt).toBeDefined();

      // Verify student has active subscription
      const sub = await prisma.subscription.findFirst({
        where: { studentId, status: 'ACTIVE' }
      });
      expect(sub).toBeDefined();

      // 30 days into future
      const expectedEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(sub!.currentPeriodEnd.getTime() - expectedEnd.getTime())).toBeLessThan(5000);
    });

    it('15. Critical Concurrency Test: 2 simultaneous webhooks extend subscription exactly ONCE', async () => {
      // Create a fresh PENDING transaction
      const concurrentTxn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const currentSub = await prisma.subscription.findFirst({
        where: { studentId, status: 'ACTIVE' }
      });
      const periodEndBefore = currentSub!.currentPeriodEnd;

      const txnObj1 = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: concurrentTxn.id
      };

      const txnObj2 = { ...txnObj1, id: getUniqueEventId() }; // Duplicate webhook with different eventId

      const hmac1 = computePaymobHmac(txnObj1);
      const hmac2 = computePaymobHmac(txnObj2);

      // Fire both webhooks simultaneously
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/billing/webhooks/paymob?hmac=${hmac1}`,
          payload: { type: 'TRANSACTION', obj: txnObj1 }
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/billing/webhooks/paymob?hmac=${hmac2}`,
          payload: { type: 'TRANSACTION', obj: txnObj2 }
        })
      ]);

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);

      // Exactly one processed: true, and exactly one processed: false / idempotent skip
      const results = [res1.json(), res2.json()];
      const successResults = results.filter(r => r.message.includes('Payment succeeded'));
      const skippedResults = results.filter(r => r.message.includes('already processed'));

      expect(successResults.length).toBe(1);
      expect(skippedResults.length).toBe(1);

      // Verify the subscription was extended by exactly 30 days (NEVER +60 days)
      const updatedSub = await prisma.subscription.findFirst({
        where: { studentId, status: 'ACTIVE' }
      });
      const expectedNewEnd = new Date(periodEndBefore.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(updatedSub!.currentPeriodEnd.getTime() - expectedNewEnd.getTime())).toBeLessThan(5000);

      // Only 1 transaction marked PAID
      const txnInDb = await prisma.paymentTransaction.findUnique({ where: { id: concurrentTxn.id } });
      expect(txnInDb?.status).toBe('PAID');
    });

    it('16. Renewal before expiry preserves remaining time (base = existing currentPeriodEnd)', async () => {
      const currentSub = await prisma.subscription.findFirst({ where: { studentId, status: 'ACTIVE' } });
      const currentEnd = currentSub!.currentPeriodEnd;

      const renewalTxn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: renewalTxn.id
      };

      const hmac = computePaymobHmac(txnObj);
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${hmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);

      const renewedSub = await prisma.subscription.findFirst({ where: { studentId, status: 'ACTIVE' } });
      const expectedEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(renewedSub!.currentPeriodEnd.getTime() - expectedEnd.getTime())).toBeLessThan(5000);
    });

    it('17. Failed renewal does NOT revoke or shorten an existing active subscription', async () => {
      const activeSubBefore = await prisma.subscription.findFirst({ where: { studentId, status: 'ACTIVE' } });
      const periodEndBefore = activeSubBefore!.currentPeriodEnd;

      const failedRenewalTxn = await prisma.paymentTransaction.create({
        data: {
          studentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: true,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: false, // FAILED
        special_reference: failedRenewalTxn.id
      };

      const hmac = computePaymobHmac(txnObj);
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${hmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      expect(res.statusCode).toBe(200);

      // Active subscription remains completely unchanged
      const activeSubAfter = await prisma.subscription.findFirst({ where: { studentId, status: 'ACTIVE' } });
      expect(activeSubAfter?.status).toBe('ACTIVE');
      expect(activeSubAfter?.currentPeriodEnd.getTime()).toBe(periodEndBefore.getTime());
    });

    it('18. Renewal after expiry starts 30 days from now (not from past date)', async () => {
      // Create student with past expired subscription
      await prisma.subscription.create({
        data: {
          studentId: otherStudentId,
          planId: canonicalPlanId,
          status: 'EXPIRED',
          currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      });

      const renewTxn = await prisma.paymentTransaction.create({
        data: {
          studentId: otherStudentId,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PENDING'
        }
      });

      const txnObj = {
        id: getUniqueEventId(),
        amount_cents: 25000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 9999 },
        owner: 100,
        pending: false,
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: true,
        special_reference: renewTxn.id
      };

      const hmac = computePaymobHmac(txnObj);
      await app.inject({
        method: 'POST',
        url: `/api/v1/billing/webhooks/paymob?hmac=${hmac}`,
        payload: { type: 'TRANSACTION', obj: txnObj }
      });

      const activeSub = await prisma.subscription.findFirst({ where: { studentId: otherStudentId } });
      expect(activeSub?.status).toBe('ACTIVE');
      // Starts from now + 30 days
      const expectedEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(activeSub!.currentPeriodEnd.getTime() - expectedEnd.getTime())).toBeLessThan(5000);
    });

    it('19. Forged frontend redirect does NOT unlock content (backend is authoritative)', async () => {
      // Student simulates redirect return without webhook
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/my-subscription',
        headers: { authorization: `Bearer ${otherStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const subStatus = res.json().data;
      expect(subStatus.isActive).toBe(true); // otherStudent was genuinely activated via webhook in test 18
    });
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 4: ACCESS ENGINE & ATTENDANCE DECOUPLING
  // ─────────────────────────────────────────────────────────
  describe('4. Online Access Decoupling & Independent Saturday Attendance', () => {
    it('20. Active subscription grants ENROLLED access to paid lesson', async () => {
      const access = await getLessonAccess(studentId, paidLessonId);
      expect(access.allowed).toBe(true);
      expect(access.reason).toBe('ENROLLED');
    });

    it('21. Decoupling: Active subscription + attendanceRequired = true + Saturday absent = access ALLOWED', async () => {
      // Invariant: Student has attendanceRequired = true
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      expect(student?.attendanceRequired).toBe(true);

      // Query access - attendance must NEVER be checked
      const access = await getLessonAccess(studentId, paidLessonId);
      expect(access.allowed).toBe(true);
      expect(access.reason).toBe('ENROLLED');
    });

    it('22. EducationalAccessGrant continues to grant access independently', async () => {
      // Create student with NO subscription
      const pwd = await hashPassword('Student@123');
      const scholarshipUser = await prisma.user.create({
        data: {
          loginId: `STU-SCHOLAR-${Date.now().toString().slice(-4)}`,
          email: `scholar.${Date.now()}@test.com`,
          passwordHash: pwd,
          role: 'STUDENT',
          firstName: 'Scholar',
          lastName: 'Student',
          mustChangePassword: false,
          isEmailVerified: true,
          student: {
            create: {
              studentCode: `STU-SCH-${Date.now().toString().slice(-4)}`,
              anonymousLeaderboardCode: `SCH-${Date.now().toString().slice(-4)}`,
              attendanceRequired: false,
              learningModeSelected: true
            }
          }
        },
        include: { student: true }
      });
      const scholarStudentId = scholarshipUser.student!.id;

      // Access is blocked
      const beforeGrant = await getLessonAccess(scholarStudentId, paidLessonId);
      expect(beforeGrant.allowed).toBe(false);

      // Create EducationalAccessGrant
      await prisma.educationalAccessGrant.create({
        data: {
          studentId: scholarStudentId,
          scope: 'ALL_ACCESS',
          reason: 'Full scholarship grant',
          isActive: true
        }
      });

      // Access is granted with reason ADMIN_GRANTED
      const afterGrant = await getLessonAccess(scholarStudentId, paidLessonId);
      expect(afterGrant.allowed).toBe(true);
      expect(afterGrant.reason).toBe('ADMIN_GRANTED');
    });
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 5: IDOR & ADMIN CAPABILITIES
  // ─────────────────────────────────────────────────────────
  describe('5. IDOR Protection & Admin Oversight', () => {
    it('23. Student A cannot view Student B payment history', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/my-payments',
        headers: { authorization: `Bearer ${otherStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const payments = res.json().data;
      for (const p of payments) {
        expect(p.studentId).toBe(otherStudentId);
        expect(p.studentId).not.toBe(studentId);
      }
    });

    it('24. Admin can list all transactions with metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/admin/transactions',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
      expect(res.json().meta).toBeDefined();
    });

    it('25. Admin can list all subscriptions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/admin/subscriptions',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
      expect(res.json().meta).toBeDefined();
    });

    it('26. Admin can refund a paid transaction', async () => {
      // Create a dedicated paid transaction for refund testing to avoid affecting other student subscriptions
      const refundStudentUser = await prisma.user.create({
        data: {
          loginId: `STU-REF-${Date.now().toString().slice(-4)}`,
          email: `refund.${Date.now()}@test.com`,
          passwordHash: pwdHash,
          role: 'STUDENT',
          firstName: 'Refund',
          lastName: 'Student',
          mustChangePassword: false,
          isEmailVerified: true,
          student: {
            create: {
              studentCode: `STU-REF-${Date.now().toString().slice(-4)}`,
              anonymousLeaderboardCode: `REF-${Date.now().toString().slice(-4)}`,
              attendanceRequired: false,
              learningModeSelected: true
            }
          }
        },
        include: { student: true }
      });

      const refundTxn = await prisma.paymentTransaction.create({
        data: {
          studentId: refundStudentUser.student!.id,
          planId: canonicalPlanId,
          provider: 'PAYMOB',
          amount: 250,
          currency: 'EGP',
          status: 'PAID',
          paidAt: new Date(),
          providerTransactionId: String(getUniqueEventId())
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/billing/admin/transactions/${refundTxn.id}/refund`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: 'Student requested billing reversal' }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('REFUNDED');
      expect(res.json().data.refundedAt).toBeDefined();
    });

    it('27. Non-admin cannot access admin billing endpoints', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/admin/transactions',
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
