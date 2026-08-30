import { prisma } from '../../db/prisma.js';
import { ListStudentsQuery, UpdateStudentInput, ResetStudentPasswordInput } from './student.schema.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { AttendanceStatus, Role, SubmissionStatus, TaskType } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { generateTempPassword, hashPassword } from '../../common/utils/crypto.js';

export async function listStudents(query: ListStudentsQuery) {
  const { groupId, search, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(groupId
      ? {
          enrollments: {
            some: { groupId, isActive: true }
          }
        }
      : {}),
    ...(search
      ? {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { loginId: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        }
      : {})
  };

  const [total, items] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      orderBy: { totalXp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            loginId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isActive: true
          }
        },
        enrollments: {
          where: { isActive: true },
          include: { group: true }
        }
      }
    })
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function getStudentById(
  studentId: string,
  requestUser: { userId: string; role: Role; studentId?: string; parentId?: string }
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: {
          id: true,
          loginId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true
        }
      },
      enrollments: {
        where: { isActive: true },
        include: { group: true }
      },
      parents: {
        include: {
          parent: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, phone: true }
              }
            }
          }
        }
      },
      achievements: {
        include: { achievement: true }
      }
    }
  });

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  // Authorization check
  if (requestUser.role === Role.ADMIN) {
    return student;
  }

  if (requestUser.role === Role.STUDENT && requestUser.studentId === studentId) {
    return student;
  }

  if (requestUser.role === Role.PARENT && requestUser.parentId) {
    const isLinked = student.parents.some((p) => p.parentId === requestUser.parentId);
    if (isLinked) {
      return student;
    }
  }

  throw new ForbiddenError('You do not have permission to view this student profile');
}

export async function getStudentProgress(
  studentId: string,
  requestUser: { userId: string; role: Role; studentId?: string; parentId?: string }
) {
  // Ensure access
  await getStudentById(studentId, requestUser);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        where: { isActive: true },
        include: { group: true }
      }
    }
  });

  if (!student) throw new NotFoundError('Student not found');

  const activeGroupId = student.enrollments[0]?.groupId;

  const [
    totalLessons,
    totalDailyTasks,
    totalChallenges,
    totalProjects,
    approvedSubmissions,
    totalSessions,
    presentAttendances
  ] = await Promise.all([
    // Total published lessons in curriculum
    prisma.lesson.count({ where: { isPublished: true } }),
    // Total assigned daily tasks
    prisma.task.count({
      where: {
        taskType: TaskType.DAILY_TASK,
        isPublished: true,
        OR: [
          { assignments: { none: {} } },
          ...(activeGroupId ? [{ assignments: { some: { groupId: activeGroupId } } }] : [])
        ]
      }
    }),
    // Total challenges
    prisma.task.count({
      where: {
        taskType: { in: [TaskType.CHALLENGE, TaskType.WEEKLY_CHALLENGE] },
        isPublished: true
      }
    }),
    // Total projects
    prisma.task.count({
      where: {
        taskType: TaskType.PROJECT,
        isPublished: true
      }
    }),
    // Student's approved submissions
    prisma.submission.findMany({
      where: {
        studentId,
        status: SubmissionStatus.APPROVED
      },
      include: { task: true }
    }),
    // Total completed sessions for student's group
    activeGroupId
      ? prisma.session.count({
          where: {
            groupId: activeGroupId,
            status: { in: ['ACTIVE', 'COMPLETED'] }
          }
        })
      : 0,
    // Present attendance count
    prisma.attendance.count({
      where: {
        studentId,
        status: AttendanceStatus.PRESENT
      }
    })
  ]);

  // Dimension 1: Programming Fundamentals (Daily Tasks completion %)
  const approvedDailyCount = approvedSubmissions.filter((s) => s.task.taskType === TaskType.DAILY_TASK).length;
  const programmingPercentage = totalDailyTasks > 0 ? Math.min(100, Math.round((approvedDailyCount / totalDailyTasks) * 100)) : 0;

  // Dimension 2: Problem Solving (Challenges completion %)
  const approvedChallengeCount = approvedSubmissions.filter((s) =>
    s.task.taskType === TaskType.CHALLENGE || s.task.taskType === TaskType.WEEKLY_CHALLENGE
  ).length;
  const problemSolvingPercentage = totalChallenges > 0 ? Math.min(100, Math.round((approvedChallengeCount / totalChallenges) * 100)) : 0;

  // Dimension 3: Official EB Curriculum (Attendance-unlocked Lessons ratio)
  const presentAttendanceCount = presentAttendances;
  const curriculumPercentage = totalLessons > 0 ? Math.min(100, Math.round((presentAttendanceCount / totalLessons) * 100)) : 0;

  // Dimension 4: Practical Projects
  const approvedProjectCount = approvedSubmissions.filter((s) => s.task.taskType === TaskType.PROJECT).length;
  const projectsPercentage = totalProjects > 0 ? Math.min(100, Math.round((approvedProjectCount / totalProjects) * 100)) : 0;

  // Classroom Attendance Rate
  const attendancePercentage = totalSessions > 0 ? Math.min(100, Math.round((presentAttendanceCount / totalSessions) * 100)) : (presentAttendanceCount > 0 ? 100 : 0);

  return {
    studentId,
    metrics: {
      programming: programmingPercentage,
      problemSolving: problemSolvingPercentage,
      curriculum: curriculumPercentage,
      projects: projectsPercentage,
      attendance: attendancePercentage
    },
    counts: {
      approvedDailyTasks: approvedDailyCount,
      totalDailyTasks,
      approvedChallenges: approvedChallengeCount,
      totalChallenges,
      approvedProjects: approvedProjectCount,
      totalProjects,
      presentSessions: presentAttendanceCount,
      totalCompletedSessions: totalSessions
    }
  };
}

export async function updateStudent(
  studentId: string,
  input: UpdateStudentInput,
  actorUserId?: string
) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError('Student not found');

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: {
      programmingLevel: input.programmingLevel,
      schoolName: input.schoolName !== undefined ? input.schoolName : undefined,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'STUDENT_PROFILE_UPDATED',
    entityType: 'Student',
    entityId: studentId,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteStudent(studentId: string, actorUserId?: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true
    }
  });

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  // Delete the associated User (which cascades Student and cleanup)
  await prisma.user.delete({
    where: { id: student.userId }
  });

  await createAuditLog({
    actorUserId,
    action: 'STUDENT_DELETED',
    entityType: 'Student',
    entityId: studentId,
    metadata: { studentCode: student.studentCode, loginId: student.user.loginId }
  });

  return { success: true };
}
export async function resetStudentPassword(
  studentId: string,
  input: Partial<ResetStudentPasswordInput> = {},
  actorUserId?: string
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      enrollments: {
        where: { isActive: true },
        include: { group: true },
        take: 1
      }
    }
  });

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  const finalPassword = input.customPassword?.trim() || generateTempPassword(8);
  const passwordHash = await hashPassword(finalPassword);
  const mustChangePassword = input.mustChangePassword !== undefined ? input.mustChangePassword : true;

  await prisma.user.update({
    where: { id: student.userId },
    data: {
      passwordHash,
      mustChangePassword
    }
  });

  // Revoke all existing refresh tokens for this user
  await prisma.refreshToken.deleteMany({
    where: { userId: student.userId }
  });

  await createAuditLog({
    actorUserId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'Student',
    entityId: studentId,
    metadata: {
      loginId: student.user.loginId,
      customPassword: Boolean(input.customPassword),
      mustChangePassword
    }
  });

  const activeGroup = student.enrollments[0]?.group;

  return {
    studentId: student.id,
    loginId: student.user.loginId,
    studentName: `${student.user.firstName} ${student.user.lastName}`.trim(),
    phone: student.user.phone,
    temporaryPassword: finalPassword,
    groupName: activeGroup?.name || null,
    groupSchedule: activeGroup?.scheduleInfo || null,
    whatsappGroupUrl: activeGroup?.whatsappGroupUrl || null
  };
}

