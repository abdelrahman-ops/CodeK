import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Parent-Student Relationship & Visibility Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let parent1Token: string;
  let parent2Token: string;
  let parent1Id: string;
  let parent2Id: string;
  let omarStudentId: string;
  let mariamStudentId: string;
  let laylaStudentId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Parent 1 login (Hassan Ali - Father)
    const p1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'PAR-2001', password: 'Parent@123' }
    });
    parent1Token = p1Res.json().data.accessToken;
    parent1Id = p1Res.json().data.user.parent.id;

    // Parent 2 login (Mona Adel - Mother)
    const p2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'PAR-2002', password: 'Parent@123' }
    });
    parent2Token = p2Res.json().data.accessToken;
    parent2Id = p2Res.json().data.user.parent.id;

    // Get Omar student ID
    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    omarStudentId = omarRes.json().data.user.student.id;

    // Get Mariam student ID
    const mariamRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1004', password: 'Student@123' }
    });
    mariamStudentId = mariamRes.json().data.user.student.id;

    // Get Layla/Youssef student ID
    const laylaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1002', password: 'Student@123' }
    });
    laylaStudentId = laylaRes.json().data.user.student.id;

    // Ensure initial links exist
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent1Id, studentId: omarStudentId } },
      create: { parentId: parent1Id, studentId: omarStudentId, relationship: 'FATHER', isPrimary: true },
      update: {}
    });
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent1Id, studentId: laylaStudentId } },
      create: { parentId: parent1Id, studentId: laylaStudentId, relationship: 'FATHER', isPrimary: false },
      update: {}
    });
  });

  it('should allow Parent 1 to view their linked children (Omar & Youssef)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parents/my-children',
      headers: { authorization: `Bearer ${parent1Token}` }
    });

    expect(res.statusCode).toBe(200);
    const children = res.json().data;
    expect(children.length).toBeGreaterThanOrEqual(2);
    const names = children.map((c: any) => c.displayName);
    expect(names).toContain('Omar Hassan');
  });

  it('should allow Parent 1 to view Omar profile and progress', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/students/${omarStudentId}`,
      headers: { authorization: `Bearer ${parent1Token}` }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(omarStudentId);
  });

  it('should FORBID Parent 1 from accessing an unrelated child (Mariam)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/students/${mariamStudentId}`,
      headers: { authorization: `Bearer ${parent1Token}` }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('should allow Parent 2 to view Mariam profile and block access to Omar', async () => {
    const ownRes = await app.inject({
      method: 'GET',
      url: `/api/v1/students/${mariamStudentId}`,
      headers: { authorization: `Bearer ${parent2Token}` }
    });
    expect(ownRes.statusCode).toBe(200);

    const otherRes = await app.inject({
      method: 'GET',
      url: `/api/v1/students/${omarStudentId}`,
      headers: { authorization: `Bearer ${parent2Token}` }
    });
    expect(otherRes.statusCode).toBe(403);
  });

  it('should link a parent to a child as FATHER and prevent duplicate rows when re-linking', async () => {
    // 1. Link parent1 to layla as FATHER
    const linkRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/parents/link-child',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        parentId: parent1Id,
        studentId: laylaStudentId,
        relationship: 'FATHER'
      }
    });
    expect(linkRes1.statusCode).toBe(200);

    const countBefore = await prisma.parentStudent.count({
      where: { parentId: parent1Id, studentId: laylaStudentId }
    });
    expect(countBefore).toBe(1);

    // 2. Re-linking same parent to same child as MOTHER updates relationship and preserves single record
    const linkRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/parents/link-child',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        parentId: parent1Id,
        studentId: laylaStudentId,
        relationship: 'MOTHER'
      }
    });
    expect(linkRes2.statusCode).toBe(200);

    const countAfter = await prisma.parentStudent.count({
      where: { parentId: parent1Id, studentId: laylaStudentId }
    });
    expect(countAfter).toBe(1);

    const record = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: { parentId: parent1Id, studentId: laylaStudentId }
      }
    });
    expect(record?.relationship).toBe('MOTHER');
  });

  it('should allow changing relationship from FATHER/MOTHER to GUARDIAN via PATCH /update-relationship', async () => {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/parents/update-relationship',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        parentId: parent1Id,
        studentId: laylaStudentId,
        relationship: 'GUARDIAN'
      }
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.relationship).toBe('GUARDIAN');

    const totalRecords = await prisma.parentStudent.count({
      where: { parentId: parent1Id, studentId: laylaStudentId }
    });
    expect(totalRecords).toBe(1);
  });

  it('should allow a student to have multiple distinct parents (e.g. Father + Mother + Guardian)', async () => {
    // Layla already has parent1 as GUARDIAN.
    // Now link parent2 as MOTHER.
    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/parents/link-child',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        parentId: parent2Id,
        studentId: laylaStudentId,
        relationship: 'MOTHER'
      }
    });
    expect(linkRes.statusCode).toBe(200);

    // Verify Layla has both parent1 and parent2
    const studentParents = await prisma.parentStudent.findMany({
      where: { studentId: laylaStudentId }
    });
    expect(studentParents.length).toBeGreaterThanOrEqual(2);

    const parentIds = studentParents.map((sp: any) => sp.parentId);
    expect(parentIds).toContain(parent1Id);
    expect(parentIds).toContain(parent2Id);
  });

  it('should allow unlinking a parent-student relationship', async () => {
    const unlinkRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/parents/unlink-child?parentId=${parent1Id}&studentId=${laylaStudentId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(unlinkRes.statusCode).toBe(200);

    const check = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: { parentId: parent1Id, studentId: laylaStudentId }
      }
    });
    expect(check).toBeNull();
  });

  it('should enforce database @@unique([parentId, studentId]) constraint against raw duplicate insert', async () => {
    // Attempting raw duplicate insertion into Prisma must throw unique constraint error
    await expect(
      prisma.parentStudent.create({
        data: {
          parentId: parent2Id,
          studentId: mariamStudentId,
          relationship: 'FATHER'
        }
      })
    ).rejects.toThrow();
  });
});
