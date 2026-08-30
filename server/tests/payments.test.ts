import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';

describe('In-Person Physical Payment Tracking & IDOR Security Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let omarToken: string;
  let omarStudentId: string;
  let youssefToken: string;
  let youssefStudentId: string;
  let hassanParentToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Omar (STU-1001)
    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    omarToken = omarRes.json().data.accessToken;
    omarStudentId = omarRes.json().data.user.student.id;

    // Youssef (STU-1002)
    const youssefRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1002', password: 'Student@123' }
    });
    youssefToken = youssefRes.json().data.accessToken;
    youssefStudentId = youssefRes.json().data.user.student.id;

    // Hassan Ali (PAR-2001) - Father of Omar
    const hassanRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'PAR-2001', password: 'Parent@123' }
    });
    hassanParentToken = hassanRes.json().data.accessToken;
  });

  it('should allow Admin to record and update physical monthly payment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: omarStudentId,
        year: 2026,
        month: 11,
        amount: 250,
        status: 'PAID',
        notes: 'Paid cash in classroom'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.status).toBe('PAID');
    expect(body.amount).toBe(250);
  });

  it('should reject payment with zero or negative amount with 400 ValidationError', async () => {
    const zeroRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: omarStudentId,
        year: 2026,
        month: 12,
        amount: 0,
        status: 'PAID'
      }
    });
    expect(zeroRes.statusCode).toBe(400);

    const negativeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: omarStudentId,
        year: 2026,
        month: 12,
        amount: -50,
        status: 'PAID'
      }
    });
    expect(negativeRes.statusCode).toBe(400);
  });

  it('should calculate monthly financial summary for Admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/summary?year=2026&month=11',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const summary = res.json().data;
    expect(summary).toHaveProperty('totalCollectedEgp');
    expect(summary).toHaveProperty('paidCount');
    expect(summary.paidCount).toBeGreaterThanOrEqual(1);
  });

  it('should allow student to view their own payment history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/student/${omarStudentId}`,
      headers: { authorization: `Bearer ${omarToken}` }
    });

    expect(res.statusCode).toBe(200);
    const payments = res.json().data;
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(payments[0].studentId).toBe(omarStudentId);
  });

  it('IDOR: should block Student A (Omar) from accessing Student B (Youssef) payments with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/student/${youssefStudentId}`,
      headers: { authorization: `Bearer ${omarToken}` }
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('IDOR: should allow linked Parent (Hassan) to view child (Omar) payments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/student/${omarStudentId}`,
      headers: { authorization: `Bearer ${hassanParentToken}` }
    });

    expect(res.statusCode).toBe(200);
    const payments = res.json().data;
    expect(payments.length).toBeGreaterThanOrEqual(1);
  });

  it('IDOR: should block Parent (Hassan) from accessing unrelated student (Youssef) payments with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/student/${youssefStudentId}`,
      headers: { authorization: `Bearer ${hassanParentToken}` }
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('should allow Admin to access any student payments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/student/${youssefStudentId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
  });
});
