import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { AttendanceStatus, PaymentStatus, Role, SubmissionStatus, TaskType } from '@prisma/client';
import { getStudentProgress } from '../students/student.service.js';
import { getMonthlyLeaderboard } from '../gamification/gamification.service.js';
import { getPaymentSummary } from '../payments/payment.service.js';

export async function getStudentDashboard(studentUserId: string) {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId },
    include: {
      user: {
        select: {
          id: true,
          loginId: true,
          firstName: true,
          lastName: true,
          avatarUrl: true
        }
      },
      enrollments: {
        where: { isActive: true },
        include: { group: true }
      },
      achievements: {
        include: { achievement: true }
      }
    }
  });

  if (!student) throw new NotFoundError('Student profile not found');

  const activeGroup = student.enrollments[0]?.group || null;

  // Find latest/active session for this group
  const latestSession = activeGroup
    ? await prisma.session.findFirst({
        where: { groupId: activeGroup.id },
        orderBy: [{ date: 'desc' }, { sessionNumber: 'desc' }],
        include: {
          sessionLessons: {
            include: {
              lesson: {
                include: {
                  tasks: {
                    where: { isPublished: true }
                  }
                }
              }
            }
          },
          attendances: {
            where: { studentId: student.id }
          }
        }
      })
    : null;

  const attendance = latestSession?.attendances[0] || null;
  const isPresent = attendance?.status === AttendanceStatus.PRESENT;

  // Unlocked lessons for latest session
  const todayLessons = latestSession?.sessionLessons.map((sl) => {
    const l = sl.lesson;
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      difficulty: l.difficulty,
      estimatedDurationMinutes: l.estimatedDurationMinutes,
      isLocked: !isPresent,
      lockReason: !isPresent ? 'ATTENDANCE_REQUIRED' : null,
      content: isPresent ? l.content : null,
      tasks: isPresent ? l.tasks : []
    };
  }) || [];

  // Group tasks available
  const groupTasks = activeGroup
    ? await prisma.task.findMany({
        where: {
          isPublished: true,
          assignments: {
            some: {
              groupId: activeGroup.id,
              availableAt: { lte: new Date() }
            }
          }
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          submissions: {
            where: { studentId: student.id }
          }
        }
      })
    : [];

  // Active Monthly Exam
  const now = new Date();
  const activeExam = await prisma.exam.findFirst({
    where: {
      isPublished: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [
        { groupId: null },
        ...(activeGroup ? [{ groupId: activeGroup.id }] : [])
      ]
    },
    include: {
      attempts: {
        where: { studentId: student.id }
      }
    }
  });

  // Progress
  const progress = await getStudentProgress(student.id, {
    userId: studentUserId,
    role: Role.STUDENT,
    studentId: student.id
  });

  // Leaderboard position
  const leaderboard = await getMonthlyLeaderboard({}, {
    userId: studentUserId,
    role: Role.STUDENT,
    studentId: student.id
  });

  const myRankEntry = leaderboard.entries.find((e) => e.isCurrentStudent) || null;

  // Notifications
  const notifications = await prisma.notification.findMany({
    where: { userId: studentUserId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  return {
    student: {
      id: student.id,
      studentCode: student.studentCode,
      anonymousLeaderboardCode: student.anonymousLeaderboardCode,
      displayName: `${student.user.firstName} ${student.user.lastName}`,
      avatarUrl: student.user.avatarUrl,
      programmingLevel: student.programmingLevel,
      totalXp: student.totalXp,
      currentStreak: student.currentStreak,
      activeGroup
    },
    todaySession: latestSession
      ? {
          sessionId: latestSession.id,
          sessionNumber: latestSession.sessionNumber,
          date: latestSession.date,
          startTime: latestSession.startTime,
          endTime: latestSession.endTime,
          status: latestSession.status,
          attendanceStatus: attendance ? attendance.status : AttendanceStatus.ABSENT,
          isPresent
        }
      : null,
    todayLessons,
    tasks: groupTasks.map((t) => ({
      id: t.id,
      title: t.title,
      taskType: t.taskType,
      difficulty: t.difficulty,
      xpReward: t.xpReward,
      mySubmission: t.submissions[0] || null
    })),
    activeExam: activeExam
      ? {
          id: activeExam.id,
          title: activeExam.title,
          durationMinutes: activeExam.durationMinutes,
          totalMarks: activeExam.totalMarks,
          xpReward: activeExam.xpReward,
          endsAt: activeExam.endsAt,
          myAttempt: activeExam.attempts[0] || null
        }
      : null,
    progress: progress.metrics,
    rank: myRankEntry ? { rank: myRankEntry.rank, monthlyXp: myRankEntry.monthlyXp } : null,
    achievements: student.achievements.map((sa) => ({
      id: sa.achievement.id,
      name: sa.achievement.name,
      icon: sa.achievement.icon,
      unlockedAt: sa.unlockedAt
    })),
    recentNotifications: notifications
  };
}

export async function getParentDashboard(parentUserId: string) {
  const parent = await prisma.parent.findUnique({
    where: { userId: parentUserId },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  loginId: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true
                }
              },
              enrollments: {
                where: { isActive: true },
                include: { group: true }
              },
              achievements: {
                include: { achievement: true }
              },
              payments: {
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                take: 1
              },
              _count: {
                select: {
                  attendances: { where: { status: 'PRESENT' } },
                  submissions: { where: { status: 'APPROVED' } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!parent) throw new NotFoundError('Parent profile not found');

  const childrenOverview = await Promise.all(
    parent.children.map(async (rel) => {
      const s = rel.student;
      const u = s.user;

      const progress = await getStudentProgress(s.id, {
        userId: parentUserId,
        role: Role.PARENT,
        parentId: parent.id
      });

      const latestExamAttempt = await prisma.examAttempt.findFirst({
        where: { studentId: s.id },
        orderBy: { submittedAt: 'desc' },
        include: { exam: true }
      });

      return {
        studentId: s.id,
        studentCode: s.studentCode,
        relationship: rel.relationship,
        displayName: `${u.firstName} ${u.lastName}`,
        avatarUrl: u.avatarUrl,
        programmingLevel: s.programmingLevel,
        totalXp: s.totalXp,
        currentStreak: s.currentStreak,
        activeGroup: s.enrollments[0]?.group || null,
        progress: progress.metrics,
        counts: progress.counts,
        latestExam: latestExamAttempt
          ? {
              examTitle: latestExamAttempt.exam.title,
              score: latestExamAttempt.score,
              totalMarks: latestExamAttempt.exam.totalMarks,
              percentage: latestExamAttempt.percentage,
              submittedAt: latestExamAttempt.submittedAt
            }
          : null,
        currentMonthPayment: s.payments[0] || null,
        achievements: s.achievements.map((sa) => ({
          id: sa.achievement.id,
          name: sa.achievement.name,
          icon: sa.achievement.icon
        }))
      };
    })
  );

  const notifications = await prisma.notification.findMany({
    where: { userId: parentUserId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  return {
    parentCode: parent.parentCode,
    children: childrenOverview,
    recentNotifications: notifications
  };
}

export async function getAdminDashboard() {
  const [
    totalStudents,
    totalParents,
    totalGroups,
    activeSessions,
    pendingSubmissionsCount,
    activeExamsCount,
    paymentSummary,
    recentAuditLogs
  ] = await Promise.all([
    prisma.student.count(),
    prisma.parent.count(),
    prisma.group.count({ where: { isActive: true } }),
    prisma.session.findMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] }
      },
      orderBy: { date: 'asc' },
      take: 5,
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { attendances: { where: { status: 'PRESENT' } } } }
      }
    }),
    prisma.submission.count({
      where: { status: SubmissionStatus.PENDING }
    }),
    prisma.exam.count({
      where: { isPublished: true }
    }),
    getPaymentSummary(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        actor: {
          select: { firstName: true, lastName: true, role: true, loginId: true }
        }
      }
    })
  ]);

  return {
    overview: {
      totalStudents,
      totalParents,
      totalGroups,
      pendingSubmissionsCount,
      activeExamsCount
    },
    financialSummary: paymentSummary,
    upcomingOrActiveSessions: activeSessions.map((s) => ({
      id: s.id,
      sessionNumber: s.sessionNumber,
      groupName: s.group.name,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      presentAttendanceCount: s._count.attendances
    })),
    recentActivity: recentAuditLogs
  };
}
