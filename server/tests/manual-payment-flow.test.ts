import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';

describe('Manual Payment Architecture: Vodafone Cash & InstaPay', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let studentUserId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Register & verify student
    const email = `manual_pay_${Date.now()}@codek.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Manual',
        lastName: 'Payer',
        email,
        password: 'Password@123'
      }
    });
    studentUserId = regRes.json().data.userId;
    const otp = regRes.json().data.devOtp;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: studentUserId, otpCode: otp }
    });
    studentToken = verifyRes.json().data.accessToken;
    studentId = verifyRes.json().data.user.student.id;

    // Select learning mode
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { mode: 'ONLINE' }
    });
  });

  it('1. Public endpoint returns active payment methods including Vodafone Cash & InstaPay', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/payment-methods'
    });

    expect(res.statusCode).toBe(200);
    const methods = res.json().data;
    expect(Array.isArray(methods)).toBe(true);

    const paymob = methods.find((m: any) => m.id === 'PAYMOB');
    const vodafone = methods.find((m: any) => m.id === 'VODAFONE_CASH');
    const instapay = methods.find((m: any) => m.id === 'INSTAPAY');

    expect(paymob).toBeDefined();
    expect(paymob.isAutomatic).toBe(true);
    expect(vodafone).toBeDefined();
    expect(vodafone.isAutomatic).toBe(false);
    expect(vodafone.receivingAccount).toBeDefined();
    expect(instapay).toBeDefined();
    expect(instapay.isAutomatic).toBe(false);
    expect(instapay.receivingAccount).toBeDefined();
  });

  it('2. Admin can update payment settings and instructions', async () => {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/billing/admin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vodafoneCashNumber: '01099887766',
        vodafoneCashInstructions: 'حول إلى رقم فودافون كاش 01099887766 ثم ارسل رقم المحفظة المحول منها',
        instaPayAddress: 'codek_official@instapay',
        instaPayInstructions: 'حول إلى العنوان codek_official@instapay ثم ارسل الرقم المرجعي للعملية'
      }
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().data;
    expect(updated.vodafoneCashNumber).toBe('01099887766');
    expect(updated.instaPayAddress).toBe('codek_official@instapay');

    // Verify change is reflected publicly
    const pubRes = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/payment-methods'
    });
    const vodafone = pubRes.json().data.find((m: any) => m.id === 'VODAFONE_CASH');
    expect(vodafone.receivingAccount).toBe('01099887766');
  });

  it('3. Student initiates Vodafone Cash checkout -> creates PENDING transaction with instructions', async () => {
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        paymentMethod: 'VODAFONE_CASH'
      }
    });

    expect(checkoutRes.statusCode).toBe(201);
    const data = checkoutRes.json().data;
    expect(data.transactionId).toBeDefined();
    expect(data.paymentMethod).toBe('VODAFONE_CASH');
    expect(data.receivingAccount).toBe('01099887766');
    expect(data.instructions).toContain('01099887766');

    // Verify transaction exists in DB with PENDING status
    const txn = await prisma.paymentTransaction.findUnique({
      where: { id: data.transactionId }
    });
    expect(txn).toBeDefined();
    expect(txn?.status).toBe('PENDING');
    expect(txn?.provider).toBe('VODAFONE_CASH');
  });

  it('4. Student submits transfer details (sender phone & reference)', async () => {
    // Get the pending transaction
    const txn = await prisma.paymentTransaction.findFirst({
      where: { studentId, provider: 'VODAFONE_CASH', status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
    expect(txn).toBeDefined();

    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/billing/manual-payments/${txn!.id}/submit`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        senderPhone: '01011112222',
        referenceNumber: 'TXN-VF-123456',
        notes: 'تم التحويل الساعة 3 عصراً'
      }
    });

    expect(submitRes.statusCode).toBe(200);
    const updated = submitRes.json().data;
    expect(updated.providerTransactionId).toBe('TXN-VF-123456');
    expect(updated.metadata.senderPhone).toBe('01011112222');
    expect(updated.metadata.submittedAt).toBeDefined();
  });

  it('5. Admin confirms manual payment -> activates subscription atomically', async () => {
    const txn = await prisma.paymentTransaction.findFirst({
      where: { studentId, provider: 'VODAFONE_CASH', status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });

    // Before confirmation: student has no active subscription
    const subBefore = await prisma.subscription.findFirst({
      where: { studentId, status: 'ACTIVE' }
    });
    expect(subBefore).toBeNull();

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/billing/admin/manual-payments/${txn!.id}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(confirmRes.statusCode).toBe(200);
    const result = confirmRes.json().data;
    expect(result.updatedTxn.status).toBe('PAID');
    expect(result.subscription.status).toBe('ACTIVE');

    // Verify in DB
    const subAfter = await prisma.subscription.findFirst({
      where: { studentId, status: 'ACTIVE' }
    });
    expect(subAfter).toBeDefined();
    expect(subAfter?.status).toBe('ACTIVE');

    // Verify audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: 'MANUAL_PAYMENT_CONFIRMED', entityId: txn!.id }
    });
    expect(auditLog).toBeDefined();
  });

  it('6. InstaPay checkout -> Student submits -> Admin rejects with reason -> does NOT activate subscription', async () => {
    // Create new student for clean assertion
    const email = `instapay_rej_${Date.now()}@codek.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { firstName: 'Insta', lastName: 'Reject', email, password: 'Password@123' }
    });
    const uid = regRes.json().data.userId;
    const otp = regRes.json().data.devOtp;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: uid, otpCode: otp }
    });
    const token = verifyRes.json().data.accessToken;
    const sId = verifyRes.json().data.user.student.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${token}` },
      payload: { mode: 'ONLINE' }
    });

    // Checkout with INSTAPAY
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: { paymentMethod: 'INSTAPAY' }
    });
    const txnId = checkoutRes.json().data.transactionId;

    // Student submits details
    await app.inject({
      method: 'POST',
      url: `/api/v1/billing/manual-payments/${txnId}/submit`,
      headers: { authorization: `Bearer ${token}` },
      payload: { referenceNumber: 'INSTA-INVALID-999' }
    });

    // Admin rejects payment
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/billing/admin/manual-payments/${txnId}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'لم يتم استلام المبلغ على الحساب البنكي' }
    });

    expect(rejectRes.statusCode).toBe(200);
    const rejData = rejectRes.json().data;
    expect(rejData.status).toBe('REJECTED');
    expect(rejData.metadata.rejectionReason).toBe('لم يتم استلام المبلغ على الحساب البنكي');

    // Confirm subscription was NOT created/activated
    const sub = await prisma.subscription.findFirst({
      where: { studentId: sId, status: 'ACTIVE' }
    });
    expect(sub).toBeNull();
  });
});
