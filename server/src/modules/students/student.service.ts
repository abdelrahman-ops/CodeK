import { prisma } from '../../db/prisma.js';
import { ListStudentsQuery, UpdateStudentInput, ResetStudentPasswordInput } from './student.schema.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { AttendanceStatus, Role, StudentGrade, SubmissionStatus, TaskType } from '@prisma/client';
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
    ...(query.grade ? { grade: query.grade } : {}),
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
        },
        subscriptions: {
          orderBy: { currentPeriodEnd: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            plan: { select: { id: true, name: true, code: true, price: true } }
          }
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
      },
      subscriptions: {
        orderBy: { currentPeriodEnd: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          plan: { select: { id: true, name: true, code: true, price: true } }
        }
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
  const gradeScope = student.grade ? { curriculum: { grade: student.grade } } : { curriculum: { id: '__NONE__' } };
  const lessonGradeScope = student.grade ? { lesson: gradeScope } : { lesson: { curriculum: { id: '__NONE__' } } };

  const [
    totalLessons,
    totalDailyTasks,
    totalChallenges,
    totalProjects,
    approvedSubmissions,
    totalSessions,
    presentAttendances,
    completedLessonsCount,
    allExamAttempts
  ] = await Promise.all([
    // Total published lessons in curriculum for student's grade
    prisma.lesson.count({ where: { isPublished: true, ...gradeScope } }),
    // Total assigned daily tasks for student's grade
    prisma.task.count({
      where: {
        taskType: TaskType.DAILY_TASK,
        isPublished: true,
        ...lessonGradeScope,
        OR: [
          { assignments: { none: {} } },
          ...(activeGroupId ? [{ assignments: { some: { groupId: activeGroupId } } }] : [])
        ]
      }
    }),
    // Total challenges for student's grade
    prisma.task.count({
      where: {
        taskType: { in: [TaskType.CHALLENGE, TaskType.WEEKLY_CHALLENGE] },
        isPublished: true,
        ...lessonGradeScope
      }
    }),
    // Total projects for student's grade
    prisma.task.count({
      where: {
        taskType: TaskType.PROJECT,
        isPublished: true,
        ...lessonGradeScope
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
    }),
    // Completed lessons count
    prisma.studentLessonProgress.count({
      where: {
        studentId,
        status: 'COMPLETED',
        ...lessonGradeScope
      }
    }),
    // Student's exam & quiz attempts
    prisma.examAttempt.findMany({
      where: {
        studentId,
        ...(student.grade ? { exam: { curriculum: { grade: student.grade } } } : { exam: { curriculum: { id: '__NONE__' } } })
      },
      include: { exam: { select: { id: true, title: true, isQuiz: true } } }
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

  // Meaningful Learning Analytics (Phase 4)
  const courseProgressPercentage = totalLessons > 0 ? Math.min(100, Math.round((completedLessonsCount / totalLessons) * 100)) : 0;
  const totalTasksCount = totalDailyTasks + totalChallenges + totalProjects;
  const tasksCompletedPercentage = totalTasksCount > 0 ? Math.min(100, Math.round((approvedSubmissions.length / totalTasksCount) * 100)) : 0;

  const quizAttempts = allExamAttempts.filter((a) => a.exam.isQuiz);
  const avgQuizScore = quizAttempts.length > 0 ? Math.round(quizAttempts.reduce((sum, a) => sum + a.percentage, 0) / quizAttempts.length) : 0;

  const realExamAttempts = allExamAttempts.filter((a) => !a.exam.isQuiz);
  const avgExamScore = realExamAttempts.length > 0 ? Math.round(realExamAttempts.reduce((sum, a) => sum + a.percentage, 0) / realExamAttempts.length) : 0;

  return {
    studentId,
    metrics: {
      programming: programmingPercentage,
      problemSolving: problemSolvingPercentage,
      curriculum: curriculumPercentage,
      projects: projectsPercentage,
      attendance: attendancePercentage
    },
    learningAnalytics: {
      courseProgress: courseProgressPercentage,
      lessonsCompleted: {
        completed: completedLessonsCount,
        total: totalLessons,
        percentage: courseProgressPercentage
      },
      tasksCompleted: {
        completed: approvedSubmissions.length,
        total: totalTasksCount,
        percentage: tasksCompletedPercentage
      },
      quizPerformance: {
        attempted: quizAttempts.length,
        averageScore: avgQuizScore
      },
      examPerformance: {
        attempted: realExamAttempts.length,
        averageScore: avgExamScore
      }
    },
    counts: {
      approvedDailyTasks: approvedDailyCount,
      totalDailyTasks,
      approvedChallenges: approvedChallengeCount,
      totalChallenges,
      approvedProjects: approvedProjectCount,
      totalProjects,
      presentSessions: presentAttendanceCount,
      totalCompletedSessions: totalSessions,
      completedLessons: completedLessonsCount,
      totalLessons
    }
  };
}

export async function getGroupGrade(groupId: string, tx: any = prisma): Promise<StudentGrade | null> {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: {
      sessions: {
        include: {
          sessionLessons: {
            include: {
              lesson: {
                include: { curriculum: true }
              }
            }
          }
        },
        take: 5
      },
      exams: {
        include: { curriculum: true },
        take: 5
      },
      taskAssignments: {
        include: {
          task: {
            include: {
              lesson: {
                include: { curriculum: true }
              }
            }
          }
        },
        take: 5
      },
      enrollments: {
        where: { isActive: true },
        include: {
          student: true
        },
        take: 10
      }
    }
  });

  if (!group) return null;

  // 1. From linked sessions/curricula
  for (const session of group.sessions || []) {
    for (const sl of session.sessionLessons || []) {
      if (sl.lesson?.curriculum?.grade) {
        return sl.lesson.curriculum.grade;
      }
    }
  }

  // 2. From linked exams
  for (const exam of group.exams || []) {
    if (exam.curriculum?.grade) {
      return exam.curriculum.grade;
    }
  }

  // 3. From task assignments
  for (const ta of group.taskAssignments || []) {
    if (ta.task?.lesson?.curriculum?.grade) {
      return ta.task.lesson.curriculum.grade;
    }
  }

  // 4. From other active enrolled students
  const activeStudentGrades = (group.enrollments || [])
    .map((e: any) => e.student?.grade)
    .filter(Boolean);
  if (activeStudentGrades.length > 0) {
    return activeStudentGrades[0] as StudentGrade;
  }

  // 5. Name / description heuristics
  const text = `${group.name} ${group.description || ''}`.toUpperCase();
  if (/\b(GRADE[_ -]?1|G1|FIRST[_ -]?YEAR|الصف الاول|الصف الأول)\b/i.test(text)) {
    return StudentGrade.GRADE_1;
  }
  if (/\b(GRADE[_ -]?2|G2|SECOND[_ -]?YEAR|الصف الثاني|الصف التانى)\b/i.test(text)) {
    return StudentGrade.GRADE_2;
  }
  if (/\b(GRADE[_ -]?3|G3|THIRD[_ -]?YEAR|الصف الثالث|الصف التالت)\b/i.test(text)) {
    return StudentGrade.GRADE_3;
  }

  return null;
}

export async function updateStudent(
  studentId: string,
  input: UpdateStudentInput,
  actorUserId?: string
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true }
  });
  if (!student) throw new NotFoundError('Student not found');

  // If email is changing, check uniqueness
  if (input.email && input.email !== student.user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email }
    });
    if (existingUser && existingUser.id !== student.userId) {
      throw new BadRequestError('Email is already registered by another user');
    }
  }

  // Update in transaction
  const updated = await prisma.$transaction(async (tx) => {
    // 1. Update user if any user fields provided
    const userUpdates: any = {};
    if (input.firstName !== undefined) userUpdates.firstName = input.firstName;
    if (input.lastName !== undefined) userUpdates.lastName = input.lastName;
    if (input.email !== undefined) userUpdates.email = input.email;
    if (input.phone !== undefined) userUpdates.phone = input.phone;
    if (input.isActive !== undefined) userUpdates.isActive = input.isActive;

    if (Object.keys(userUpdates).length > 0) {
      await tx.user.update({
        where: { id: student.userId },
        data: userUpdates
      });
    }

    // 2. Grade and Group integrity validation
    const targetGrade = input.grade !== undefined ? input.grade : student.grade;

    if (input.groupId !== undefined) {
      if (input.groupId) {
        const group = await tx.group.findUnique({ where: { id: input.groupId } });
        if (!group) throw new NotFoundError('Class group not found');

        const groupGrade = await getGroupGrade(input.groupId, tx);
        if (groupGrade !== null && targetGrade !== null && groupGrade !== targetGrade) {
          throw new BadRequestError(`Cannot assign student of grade ${targetGrade} to group belonging to grade ${groupGrade}`);
        }
      }

      await tx.groupEnrollment.updateMany({
        where: { studentId, isActive: true },
        data: { isActive: false, endedAt: new Date() }
      });

      if (input.groupId) {
        const existingEnrollment = await tx.groupEnrollment.findFirst({
          where: { studentId, groupId: input.groupId }
        });
        if (existingEnrollment) {
          await tx.groupEnrollment.update({
            where: { id: existingEnrollment.id },
            data: { isActive: true, endedAt: null }
          });
        } else {
          await tx.groupEnrollment.create({
            data: { studentId, groupId: input.groupId, isActive: true }
          });
        }
      }
    } else if (input.grade !== undefined && input.grade !== student.grade) {
      // Grade is changing, but groupId was not explicitly provided.
      // Check active enrollment compatibility with the new grade.
      const activeEnrollments = await tx.groupEnrollment.findMany({
        where: { studentId, isActive: true },
        include: { group: true }
      });

      for (const enrollment of activeEnrollments) {
        const groupGrade = await getGroupGrade(enrollment.groupId, tx);
        if (groupGrade !== null && groupGrade !== input.grade) {
          // Explicitly clear/deactivate old-grade group enrollment to maintain grade-isolation invariant
          await tx.groupEnrollment.update({
            where: { id: enrollment.id },
            data: { isActive: false, endedAt: new Date() }
          });
        }
      }
    }

    // 3. Update student record
    const studentUpdates: any = {};
    if (input.programmingLevel !== undefined) studentUpdates.programmingLevel = input.programmingLevel;
    if (input.grade !== undefined) studentUpdates.grade = input.grade;
    if (input.schoolName !== undefined) studentUpdates.schoolName = input.schoolName;
    if (input.dateOfBirth !== undefined) studentUpdates.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    if (input.attendanceRequired !== undefined) studentUpdates.attendanceRequired = input.attendanceRequired;

    return tx.student.update({
      where: { id: studentId },
      data: studentUpdates,
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
    });
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

export async function bulkUpdateStudentStatus(
  studentIds: string[],
  isActive: boolean,
  actorUserId?: string
) {
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, userId: true }
  });

  const userIds = students.map((s) => s.userId);

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { isActive }
  });

  await createAuditLog({
    actorUserId,
    action: isActive ? 'STUDENTS_BULK_ACTIVATED' : 'STUDENTS_BULK_DEACTIVATED',
    entityType: 'Student',
    entityId: studentIds[0] || null,
    metadata: { count: students.length, studentIds, isActive }
  });

  return {
    success: true,
    count: students.length,
    studentIds: students.map((s) => s.id)
  };
}

export async function bulkAssignGroup(
  studentIds: string[],
  groupId: string | null,
  actorUserId?: string
) {
  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError('Class group not found');
  }

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const studentId of studentIds) {
    try {
      await prisma.$transaction(async (tx) => {
        // Deactivate existing active enrollments
        await tx.groupEnrollment.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false }
        });

        // If assigning to a new group, create or reactivate enrollment
        if (groupId) {
          const existing = await tx.groupEnrollment.findFirst({
            where: { studentId, groupId }
          });

          if (existing) {
            await tx.groupEnrollment.update({
              where: { id: existing.id },
              data: { isActive: true }
            });
          } else {
            await tx.groupEnrollment.create({
              data: { studentId, groupId, isActive: true }
            });
          }
        }
      });
      results.push({ id: studentId, success: true });
    } catch (err: any) {
      results.push({ id: studentId, success: false, error: err.message });
    }
  }

  const successful = results.filter((r) => r.success).map((r) => r.id);
  const failed = results.filter((r) => !r.success).map((r) => ({ id: r.id, reason: r.error || 'Failed to assign group' }));

  await createAuditLog({
    actorUserId,
    action: 'STUDENTS_BULK_GROUP_ASSIGNED',
    entityType: 'Student',
    entityId: groupId || 'unassigned',
    metadata: { groupId, successfulCount: successful.length, failedCount: failed.length }
  });

  return {
    success: failed.length === 0,
    successful,
    failed
  };
}

export async function bulkDeleteStudents(
  studentIds: string[],
  actorUserId?: string
) {
  const successful: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const studentId of studentIds) {
    try {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: true,
          _count: {
            select: {
              subscriptions: true,
              paymentTransactions: true,
              payments: true,
              attendances: true,
              submissions: true,
              examAttempts: true
            }
          }
        }
      });

      if (!student) {
        failed.push({ id: studentId, reason: 'Student not found' });
        continue;
      }

      const totalHistoryRecords =
        student._count.subscriptions +
        student._count.paymentTransactions +
        student._count.payments +
        student._count.attendances +
        student._count.submissions +
        student._count.examAttempts;

      if (totalHistoryRecords > 0) {
        failed.push({
          id: studentId,
          reason: `Cannot delete student with historical records (${student._count.subscriptions} subs, ${student._count.payments} payments, ${student._count.attendances} attendances, ${student._count.submissions} submissions). Deactivate instead.`
        });
        continue;
      }

      // Safe to delete student and user
      await prisma.user.delete({
        where: { id: student.userId }
      });

      successful.push(studentId);
    } catch (err: any) {
      failed.push({ id: studentId, reason: err.message || 'Deletion failed' });
    }
  }

  await createAuditLog({
    actorUserId,
    action: 'STUDENTS_BULK_DELETED',
    entityType: 'Student',
    entityId: studentIds[0] || null,
    metadata: { successfulCount: successful.length, failedCount: failed.length }
  });

  return {
    success: failed.length === 0,
    successful,
    failed
  };
}

