import { Role, StudentGrade } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../common/errors/app-error.js';

/**
 * Normalizes any grade representation into the canonical StudentGrade enum.
 * Rejects arbitrary strings by returning null.
 */
export function normalizeGrade(grade?: string | null): StudentGrade | null {
  if (!grade) return null;
  const trimmed = grade.trim();
  if (trimmed === 'GRADE_1' || trimmed.includes('الأول') || trimmed === '1' || trimmed === 'G10') {
    return StudentGrade.GRADE_1;
  }
  if (trimmed === 'GRADE_2' || trimmed.includes('الثاني') || trimmed === '2' || trimmed === 'G11') {
    return StudentGrade.GRADE_2;
  }
  if (trimmed === 'GRADE_3' || trimmed.includes('الثالث') || trimmed === '3' || trimmed === 'G12') {
    return StudentGrade.GRADE_3;
  }
  return null;
}

/**
 * Resolves the authenticated student's authoritative grade from the database.
 */
export async function getStudentGrade(studentId: string): Promise<StudentGrade | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { grade: true }
  });
  return student?.grade ?? null;
}

/**
 * Enforces grade isolation between the student's assigned grade and the content's target grade.
 *
 * Security Principle:
 * If the student does not belong to the content's grade universe, a NotFoundError (404)
 * is thrown to avoid leaking the resource's existence or title to students of other grades.
 */
export function assertGradeAccess(
  studentGrade: StudentGrade | null | undefined,
  targetGrade: StudentGrade,
  resourceName = 'Resource'
): void {
  if (!studentGrade || studentGrade !== targetGrade) {
    throw new NotFoundError(`${resourceName} not found`);
  }
}
