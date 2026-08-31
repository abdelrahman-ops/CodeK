import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';

describe('Group Schedule & Session Creation Refactor Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let singleScheduleGroupId: string;
  let multiScheduleGroupId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
  });

  it('1. should create a group with one weekly schedule day', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Single Schedule Group',
        maxCapacity: 15,
        schedules: [
          { dayOfWeek: 6, startTime: '16:00', endTime: '17:30' } // Saturday
        ]
      }
    });

    expect(res.statusCode).toBe(201);
    const group = res.json().data;
    expect(group.name).toBe('Single Schedule Group');
    expect(group.schedules).toHaveLength(1);
    expect(group.schedules[0].dayOfWeek).toBe(6);
    expect(group.schedules[0].startTime).toBe('16:00');
    expect(group.schedules[0].endTime).toBe('17:30');
    singleScheduleGroupId = group.id;
  });

  it('2. should create a group with multiple weekly schedule days', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Multi Schedule Group',
        maxCapacity: 20,
        schedules: [
          { dayOfWeek: 6, startTime: '16:00', endTime: '17:30' }, // Saturday
          { dayOfWeek: 1, startTime: '16:00', endTime: '17:30' }, // Monday
          { dayOfWeek: 3, startTime: '16:00', endTime: '17:30' }  // Wednesday
        ]
      }
    });

    expect(res.statusCode).toBe(201);
    const group = res.json().data;
    expect(group.name).toBe('Multi Schedule Group');
    expect(group.schedules).toHaveLength(3);
    multiScheduleGroupId = group.id;
  });

  it('3. should prevent duplicate schedule entries for the same group and day of week', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Duplicate Day Group',
        maxCapacity: 10,
        schedules: [
          { dayOfWeek: 6, startTime: '16:00', endTime: '17:30' },
          { dayOfWeek: 6, startTime: '18:00', endTime: '19:30' } // Duplicate Saturday
        ]
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Duplicate day of week');
  });

  it('4. should find groups scheduled for a specific weekday', async () => {
    // Saturday date e.g. 2026-09-05
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/today-schedule?date=2026-09-05',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const scheduled = res.json().data;
    expect(Array.isArray(scheduled)).toBe(true);
    const groupNames = scheduled.map((s: any) => s.groupName);
    expect(groupNames).toContain('Single Schedule Group');
    expect(groupNames).toContain('Multi Schedule Group');
  });

  it('5. should automatically derive session time and next session number from GroupSchedule', async () => {
    // Create session for Single Schedule Group on Saturday (2026-09-05) without passing startTime/endTime or sessionNumber
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        date: '2026-09-05'
      }
    });

    expect(res.statusCode).toBe(201);
    const session = res.json().data;
    expect(session.sessionNumber).toBe(1);
    expect(session.startTime).toBe('16:00');
    expect(session.endTime).toBe('17:30');
  });

  it('6. should automatically generate next session number for sequential sessions', async () => {
    // Next session on next Saturday (2026-09-12)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        date: '2026-09-12'
      }
    });

    expect(res.statusCode).toBe(201);
    const session = res.json().data;
    expect(session.sessionNumber).toBe(2);
  });

  it('7. should prevent duplicate session numbers for the same group', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        sessionNumber: 1, // Explicit duplicate sessionNumber
        date: '2026-09-19',
        isOverride: true
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('already exists');
  });

  it('8. should allow manual session time and date override when isOverride is true', async () => {
    // Single Schedule Group only meets Saturday, but override allows Sunday 2026-09-06 at 18:00
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        date: '2026-09-06', // Sunday
        startTime: '18:00',
        endTime: '19:30',
        isOverride: true
      }
    });

    expect(res.statusCode).toBe(201);
    const session = res.json().data;
    expect(session.sessionNumber).toBe(3);
    expect(session.startTime).toBe('18:00');
    expect(session.endTime).toBe('19:30');
  });

  it('9. should reject session creation on unscheduled day without override flag', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        date: '2026-09-07' // Monday (Single Schedule Group only meets Saturday)
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('does not have a recurring schedule');
  });

  it('10. should handle cancelled sessions without corrupting next session number calculation', async () => {
    // Create session #4
    const res4 = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        date: '2026-09-26'
      }
    });
    expect(res4.statusCode).toBe(201);
    const sess4 = res4.json().data;
    expect(sess4.sessionNumber).toBe(4);

    // Cancel session #4
    const cancelRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${sess4.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'CANCELLED' }
    });
    expect(cancelRes.statusCode).toBe(200);

    // Creating next session should yield sessionNumber 5
    const res5 = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: singleScheduleGroupId,
        date: '2026-10-03'
      }
    });
    expect(res5.statusCode).toBe(201);
    expect(res5.json().data.sessionNumber).toBe(5);
  });
});
