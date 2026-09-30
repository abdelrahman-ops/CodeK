import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin, loginStudent } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { StudentGrade, VideoAssetStatus, AttendanceStatus, ContentAuthority } from '@prisma/client';

describe('Admin Student Management & Grade Architecture Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
  });

  it('1. should list students filtered by grade', async () => {
    // Ensure we have a student in GRADE_1 and GRADE_2
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/students?grade=GRADE_1&limit=50',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    for (const student of body.data) {
      expect(student.grade).toBe('GRADE_1');
    }
  });

  it('2. should update student profile, user credentials, grade, and group assignment', async () => {
    const timestamp = Date.now();
    // 1. Create a student to edit
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'OriginalFirst',
        lastName: 'OriginalLast',
        email: `edit_target_${timestamp}@codek.test`,
        password: 'Password123!',
        phone: `+2010${timestamp.toString().slice(-8)}`,
        grade: 'GRADE_1'
      }
    });
    expect(regRes.statusCode).toBe(201);
    const regData = regRes.json().data;

    // Verify email to finalize user
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        userId: regData.userId,
        otpCode: regData.devOtp
      }
    });

    const studentRecord = await prisma.student.findUnique({
      where: { userId: regData.userId }
    });
    expect(studentRecord).not.toBeNull();
    const studentId = studentRecord!.id;

    // Create a target group for assignment
    const targetGroup = await prisma.group.create({
      data: {
        name: `Admin Reassign Group ${timestamp}`,
        description: 'Test target group',
        maxCapacity: 25
      }
    });

    // 2. Admin performs full update on student
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/students/${studentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        email: `updated_email_${timestamp}@codek.test`,
        phone: '+201122334455',
        grade: 'GRADE_2',
        groupId: targetGroup.id,
        isActive: false,
        attendanceRequired: true
      }
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().data;
    expect(updated.id).toBe(studentId);
    expect(updated.grade).toBe('GRADE_2');
    expect(updated.attendanceRequired).toBe(true);
    expect(updated.user.firstName).toBe('UpdatedFirst');
    expect(updated.user.lastName).toBe('UpdatedLast');
    expect(updated.user.email).toBe(`updated_email_${timestamp}@codek.test`);
    expect(updated.user.phone).toBe('+201122334455');
    expect(updated.user.isActive).toBe(false);

    // 3. Verify in database
    const dbStudent = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        enrollments: { where: { isActive: true }, include: { group: true } }
      }
    });
    expect(dbStudent?.grade).toBe(StudentGrade.GRADE_2);
    expect(dbStudent?.user.firstName).toBe('UpdatedFirst');
    expect(dbStudent?.user.lastName).toBe('UpdatedLast');
    expect(dbStudent?.user.email).toBe(`updated_email_${timestamp}@codek.test`);
    expect(dbStudent?.user.phone).toBe('+201122334455');
    expect(dbStudent?.user.isActive).toBe(false);
    expect(dbStudent?.enrollments[0]?.groupId).toBe(targetGroup.id);
  });

  it('3. should retrieve video asset details with playback metadata', async () => {
    // Create a mock ready video asset
    const asset = await prisma.videoAsset.create({
      data: {
        title: 'Admin Preview Test Video',
        provider: 'MUX',
        providerVideoId: 'mock_asset_123',
        playbackId: 'mock_playback_abc',
        status: 'READY',
        durationSeconds: 120
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/videos/${asset.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.id).toBe(asset.id);
    expect(body.playbackId).toBe('mock_playback_abc');
    expect(body.previewPlayback).toBeDefined();
    expect(body.previewPlayback.playbackUrl).toContain('mock_playback_abc');

    // Cleanup
    await prisma.videoAsset.delete({ where: { id: asset.id } });
  });

  it('4. should handle non-ready or missing playback video assets cleanly and enforce RBAC', async () => {
    const studentToken = await loginStudent(app);

    // 1. Video asset in PROCESSING status
    const processingAsset = await prisma.videoAsset.create({
      data: {
        title: 'Processing Video Asset',
        provider: 'MUX',
        providerVideoId: 'mock_asset_proc',
        status: VideoAssetStatus.PROCESSING
      }
    });

    const procRes = await app.inject({
      method: 'GET',
      url: `/api/v1/videos/${processingAsset.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(procRes.statusCode).toBe(200);
    const procBody = procRes.json().data;
    expect(procBody.previewPlayback).toBeNull();
    expect(procBody.playbackUrl).toBeNull();

    // 2. Video asset with status READY but missing playbackId
    const missingPlaybackAsset = await prisma.videoAsset.create({
      data: {
        title: 'Missing Playback Asset',
        provider: 'MUX',
        providerVideoId: 'mock_missing_pb',
        status: VideoAssetStatus.READY
      }
    });

    const missingRes = await app.inject({
      method: 'GET',
      url: `/api/v1/videos/${missingPlaybackAsset.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(missingRes.statusCode).toBe(200);
    const missingBody = missingRes.json().data;
    expect(missingBody.previewPlayback).toBeNull();

    // 3. Non-admin student cannot access admin preview endpoint
    const studentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/videos/${processingAsset.id}`,
      headers: { authorization: `Bearer ${studentToken}` }
    });
    expect(studentRes.statusCode).toBe(403);

    // 4. Unauthenticated request rejected with 401
    const anonRes = await app.inject({
      method: 'GET',
      url: `/api/v1/videos/${processingAsset.id}`
    });
    expect(anonRes.statusCode).toBe(401);

    // Cleanup
    await prisma.videoAsset.deleteMany({
      where: { id: { in: [processingAsset.id, missingPlaybackAsset.id] } }
    });
  });

  it('5. should read payment receiving accounts dynamically from backend configuration', async () => {
    // 1. Verify default receiving accounts are returned dynamically
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/payment-methods'
    });
    expect(initialRes.statusCode).toBe(200);
    const methods = initialRes.json().data;
    const vodafone = methods.find((m: any) => m.id === 'VODAFONE_CASH');
    const instapay = methods.find((m: any) => m.id === 'INSTAPAY');
    expect(vodafone).toBeDefined();
    expect(instapay).toBeDefined();

    const originalVodafoneNum = vodafone.receivingAccount;
    const originalInstapayAddr = instapay.receivingAccount;

    // 2. Admin updates receiving accounts
    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/billing/admin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vodafoneCashNumber: '01055554444',
        instaPayAddress: 'test_dynamic@instapay'
      }
    });
    expect(updateRes.statusCode).toBe(200);

    // 3. Verify public API response reflects updated receiving accounts without code changes
    const updatedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/payment-methods'
    });
    expect(updatedRes.statusCode).toBe(200);
    const updatedMethods = updatedRes.json().data;
    expect(updatedMethods.find((m: any) => m.id === 'VODAFONE_CASH')?.receivingAccount).toBe('01055554444');
    expect(updatedMethods.find((m: any) => m.id === 'INSTAPAY')?.receivingAccount).toBe('test_dynamic@instapay');

    // Revert settings
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/billing/admin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vodafoneCashNumber: originalVodafoneNum,
        instaPayAddress: originalInstapayAddr
      }
    });
  });

  it('6. should protect canonical official curriculum while allowing deletion of non-canonical/test curriculum', async () => {
    const timestamp = Date.now();

    // 1. Ensure canonical official curriculum cannot be deleted
    const canonical = await prisma.curriculum.findFirst({
      where: { code: 'G11-T1-EB-2026', authority: ContentAuthority.OFFICIAL }
    });
    if (canonical) {
      const delCanonicalRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/curriculum/${canonical.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(delCanonicalRes.statusCode).toBe(400);
      const json = delCanonicalRes.json();
      const errMsg = json.error?.message || json.error || json.message || '';
      expect(errMsg).toContain('official curriculum');
    }

    // 2. Create a test curriculum with type: OFFICIAL_EB and authority: PROPOSED (not the canonical official curriculum)
    const testEB = await prisma.curriculum.create({
      data: {
        code: `TEST-EB-CAN-DELETE-${timestamp}`,
        title: `Test Egyptian Baccalaureate Draft ${timestamp}`,
        type: 'OFFICIAL_EB',
        authority: ContentAuthority.PROPOSED,
        grade: StudentGrade.GRADE_2
      }
    });

    // 3. Deleting testEB should succeed because it is not the canonical official curriculum
    const delTestRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/curriculum/${testEB.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(delTestRes.statusCode).toBe(200);

    const checkTestEB = await prisma.curriculum.findUnique({ where: { id: testEB.id } });
    expect(checkTestEB).toBeNull();
  });

  it('7. should enforce grade-change integrity and preserve historical records without cross-grade inconsistency', async () => {
    const timestamp = Date.now();

    // 1. Create a student with GRADE_1
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Grade1Student',
        lastName: 'IsolationTest',
        email: `g1_integrity_${timestamp}@codek.test`,
        password: 'Password123!',
        phone: `+2010${timestamp.toString().slice(-8)}`,
        grade: 'GRADE_1'
      }
    });
    const regData = regRes.json().data;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: regData.userId, otpCode: regData.devOtp }
    });

    const studentRecord = await prisma.student.findUnique({
      where: { userId: regData.userId }
    });
    const studentId = studentRecord!.id;

    // 2. Create a Grade 1 group (with explicit name heuristic and curriculum session)
    const g1Group = await prisma.group.create({
      data: {
        name: `Grade 1 Test Cohort ${timestamp}`,
        description: 'Cohort strictly for GRADE_1',
        maxCapacity: 20
      }
    });

    const g1Session = await prisma.session.create({
      data: {
        groupId: g1Group.id,
        sessionNumber: 1,
        date: new Date(),
        startTime: '10:00',
        endTime: '11:30'
      }
    });

    // Enroll student in g1Group
    const enrollment = await prisma.groupEnrollment.create({
      data: {
        studentId,
        groupId: g1Group.id,
        isActive: true
      }
    });

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        sessionId: g1Session.id,
        studentId,
        status: AttendanceStatus.PRESENT
      }
    });

    // 3. Admin changes student grade to GRADE_2 without providing groupId
    const gradeChangeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/students/${studentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        grade: 'GRADE_2'
      }
    });

    expect(gradeChangeRes.statusCode).toBe(200);
    const gradeChangeBody = gradeChangeRes.json().data;
    expect(gradeChangeBody.grade).toBe('GRADE_2');
    // Active enrollments returned in payload must be empty because the old group belongs to GRADE_1
    expect(gradeChangeBody.enrollments.length).toBe(0);

    // 4. Verify in database: group enrollment was safely deactivated with endedAt timestamp
    const dbEnrollment = await prisma.groupEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(dbEnrollment?.isActive).toBe(false);
    expect(dbEnrollment?.endedAt).not.toBeNull();

    // 5. Verify historical attendance record was NOT deleted
    const dbAttendance = await prisma.attendance.findUnique({
      where: { id: attendance.id }
    });
    expect(dbAttendance).not.toBeNull();
    expect(dbAttendance?.status).toBe(AttendanceStatus.PRESENT);

    // 6. Admin attempts to assign the GRADE_2 student back to the GRADE_1 group -> must be rejected
    const invalidAssignRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/students/${studentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId: g1Group.id
      }
    });

    expect(invalidAssignRes.statusCode).toBe(400);
    const assignJson = invalidAssignRes.json();
    const assignErrMsg = assignJson.error?.message || assignJson.error || assignJson.message || '';
    expect(assignErrMsg).toContain('Cannot assign student of grade GRADE_2 to group belonging to grade GRADE_1');

    // Cleanup
    await prisma.attendance.delete({ where: { id: attendance.id } });
    await prisma.session.delete({ where: { id: g1Session.id } });
    await prisma.groupEnrollment.deleteMany({ where: { studentId } });
    await prisma.group.delete({ where: { id: g1Group.id } });
  });
});
