import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';

describe('Public Student Registration & Admission Pipeline Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let createdRegistrationId: string;
  let registrationCode: string;
  let testPhone = `01099${Math.floor(100000 + Math.random() * 900000)}`;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
  });

  it('1. should retrieve public registration status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/public/registration-status'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body).toHaveProperty('isOpen');
    expect(body).toHaveProperty('currentRegistrationsCount');
  });

  it('2. should submit a public student registration successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/registrations',
      payload: {
        firstName: 'Tariq',
        lastName: 'Ziad',
        phone: testPhone,
        whatsappPhone: testPhone,
        email: `tariq.${Date.now()}@example.com`,
        schoolName: 'Future International School',
        grade: 'Grade 10',
        programmingLevel: 'BEGINNER',
        previousExperience: 'Studied Python basics',
        motivation: 'Want to become a software engineer',
        preferredDays: 'Saturday, Monday',
        preferredTimes: '4:00 PM - 5:30 PM',
        parentName: 'Ziad Mahmoud',
        parentPhone: '01011223344',
        parentRelationship: 'FATHER',
        formLoadedAt: Date.now() - 3000 // 3 seconds ago
      }
    });

    expect(res.statusCode).toBe(201);
    const reg = res.json().data;
    expect(reg).toHaveProperty('id');
    expect(reg.registrationCode).toMatch(/^REG-[A-Z0-9]{5}$/);
    expect(reg.status).toBe('PENDING');
    expect(reg.phone).toBe(`+20${testPhone.substring(1)}`); // Normalized Egyptian phone

    createdRegistrationId = reg.id;
    registrationCode = reg.registrationCode;
  });

  it('3. should reject honeypot spam submissions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/registrations',
      payload: {
        firstName: 'Bot',
        lastName: 'Spammer',
        phone: '01000000000',
        website: 'http://spam-link.com' // Honeypot filled!
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Invalid registration submission');
  });

  it('4. should prevent duplicate registration for the same phone number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/registrations',
      payload: {
        firstName: 'Tariq',
        lastName: 'Ziad',
        phone: testPhone // Same phone number
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('already exists');
  });

  it('5. should allow admin to list registrations and filter by status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/registrations?status=PENDING',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.counts).toHaveProperty('PENDING');
  });

  it('6. should allow admin to view detailed registration information', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/registrations/${createdRegistrationId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const reg = res.json().data;
    expect(reg.id).toBe(createdRegistrationId);
    expect(reg.registrationCode).toBe(registrationCode);
    expect(reg.firstName).toBe('Tariq');
  });

  it('7. should allow admin to update registration status and admin notes', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/registrations/${createdRegistrationId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'UNDER_REVIEW',
        adminNotes: 'Candidate interviewed over phone, high potential.'
      }
    });

    expect(res.statusCode).toBe(200);
    const reg = res.json().data;
    expect(reg.status).toBe('UNDER_REVIEW');
    expect(reg.adminNotes).toContain('Candidate interviewed');
  });

  it('8. should approve registration, transactional user creation, and generate WhatsApp onboarding link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/registrations/${createdRegistrationId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        adminNotes: 'Approved after interview.'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.registration.status).toBe('APPROVED');
    expect(body.credentials).toHaveProperty('loginId');
    expect(body.credentials.loginId).toMatch(/^STU-[A-Z0-9]{4}$/);
    expect(body.credentials).toHaveProperty('temporaryPassword');
    expect(body.whatsappOnboarding).toHaveProperty('whatsappUrl');
    expect(body.whatsappOnboarding.whatsappUrl).toContain(`https://wa.me/20${testPhone.substring(1)}?text=`);
  });

  it('9. should prevent duplicate approval of already approved registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/registrations/${createdRegistrationId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('already approved');
  });

  it('10. should allow updating registration controls (closing registration)', async () => {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/registrations/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        isOpen: false
      }
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.isOpen).toBe(false);

    // Verify submission is rejected when closed
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/v1/public/registrations',
      payload: {
        firstName: 'Blocked',
        lastName: 'User',
        phone: '01011112222'
      }
    });

    expect(submitRes.statusCode).toBe(400);
    expect(submitRes.json().error.message).toContain('closed');

    // Re-open for subsequent runs
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/registrations/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        isOpen: true
      }
    });
  });
});
