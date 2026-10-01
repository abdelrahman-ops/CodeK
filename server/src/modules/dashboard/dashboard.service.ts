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
                  curriculum: { select: { id: true, grade: true } },
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

  // Check if student has active online entitlement
  const activeSub = await prisma.subscription.findFirst({
    where: {
      studentId: student.id,
      status: 'ACTIVE',
      currentPeriodEnd: { gte: new Date() }
    },
    include: { plan: true }
  });
  const hasSubscription = Boolean(activeSub);

  const latestSub = activeSub || await prisma.subscription.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    include: { plan: true }
  });

  // Lessons for latest session (Decoupled from attendance, grade-scoped)
  const todayLessons = (latestSession?.sessionLessons || [])
    .filter((sl) => Boolean(student.grade && sl.lesson.curriculum?.grade === student.grade))
    .map((sl) => {
      const l = sl.lesson;
      const canAccess = l.isFree || hasSubscription;
      return {
        id: l.id,
        title: l.title,
        description: l.description,
        difficulty: l.difficulty,
        estimatedDurationMinutes: l.estimatedDurationMinutes,
        isLocked: !canAccess,
        lockReason: !canAccess ? 'SUBSCRIPTION_REQUIRED' : null,
        content: canAccess ? l.content : null,
        tasks: canAccess ? l.tasks : []
      };
    });

  const now = new Date();

  // Parallelize independent queries
  const [
    groupTasks,
    activeOrUpcomingExam,
    continueLearning,
    progress,
    leaderboard,
    notifications
  ] = await Promise.all([
    // Group tasks available (grade-scoped, null-grade receives empty array)
    activeGroup && student.grade
      ? prisma.task.findMany({
          where: {
            isPublished: true,
            lesson: { curriculum: { grade: student.grade } },
            assignments: {
              some: {
                groupId: activeGroup.id,
                availableAt: { lte: now }
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
      : Promise.resolve([]),

    // Active or Upcoming Exam / Quiz (grade-scoped, null-grade receives null)
    student.grade
      ? prisma.exam.findFirst({
          where: {
            isPublished: true,
            endsAt: { gte: now },
            curriculum: { grade: student.grade },
            OR: [
              { groupId: null },
              ...(activeGroup ? [{ groupId: activeGroup.id }] : [])
            ]
          },
          orderBy: { startsAt: 'asc' },
          include: {
            attempts: {
              where: { studentId: student.id }
            },
            lesson: { select: { id: true, title: true } }
          }
        })
      : Promise.resolve(null),

    // Continue Learning (Tier 1 Priority, grade-scoped, null-grade receives null)
    (async () => {
      if (!student.grade) return null;
      const lastProgress = await prisma.studentLessonProgress.findFirst({
        where: {
          studentId: student.id,
          lesson: { curriculum: { grade: student.grade } }
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          lesson: {
            include: {
              curriculum: { select: { id: true, title: true, grade: true } }
            }
          }
        }
      });

      if (lastProgress && lastProgress.lesson.curriculum.grade === student.grade) {
        return {
          courseId: lastProgress.lesson.curriculumId,
          courseTitle: lastProgress.lesson.curriculum.title,
          lessonId: lastProgress.lessonId,
          lessonTitle: lastProgress.lesson.title,
          progressPercentage: lastProgress.progressPercentage,
          lastWatchedPosition: lastProgress.lastWatchedPosition,
          status: lastProgress.status
        };
      }

      const firstCourse = await prisma.curriculum.findFirst({
        where: {
          isPublished: true,
          grade: student.grade
        },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { order: 'asc' },
            take: 1
          }
        }
      });

      if (firstCourse && firstCourse.lessons[0]) {
        return {
          courseId: firstCourse.id,
          courseTitle: firstCourse.title,
          lessonId: firstCourse.lessons[0].id,
          lessonTitle: firstCourse.lessons[0].title,
          progressPercentage: 0,
          lastWatchedPosition: 0,
          status: 'NOT_STARTED'
        };
      }

      return null;
    })(),

    // Progress & Learning Analytics
    getStudentProgress(student.id, {
      userId: studentUserId,
      role: Role.STUDENT,
      studentId: student.id
    }),

    // Leaderboard position (Tier 7 Priority)
    getMonthlyLeaderboard({}, {
      userId: studentUserId,
      role: Role.STUDENT,
      studentId: student.id
    }),

    // Notifications
    prisma.notification.findMany({
      where: { userId: studentUserId },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  const myRankEntry = leaderboard.entries.find((e) => e.isCurrentStudent) || null;
  const topPeers = leaderboard.entries.slice(0, 5).map((e) => ({
    rank: e.rank,
    anonymousCode: e.anonymousCode,
    monthlyXp: e.monthlyXp,
    isCurrentStudent: e.isCurrentStudent
  }));

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
      attendanceRequired: student.attendanceRequired,
      activeGroup
    },
    // Commercial Online Subscription Status
    subscription: latestSub ? {
      id: latestSub.id,
      status: activeSub ? 'ACTIVE' : latestSub.status,
      currentPeriodStart: latestSub.currentPeriodStart,
      currentPeriodEnd: latestSub.currentPeriodEnd,
      cancelAtPeriodEnd: latestSub.cancelAtPeriodEnd,
      isActive: Boolean(activeSub),
      plan: latestSub.plan ? {
        id: latestSub.plan.id,
        name: latestSub.plan.name,
        price: latestSub.plan.price,
        currency: latestSub.plan.currency
      } : null
    } : {
      id: null,
      status: 'NONE',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      isActive: false,
      plan: null
    },
    // Tier 1: Continue Learning
    continueLearning,
    // Tier 2: Today's Tasks
    tasks: groupTasks.map((t) => ({
      id: t.id,
      title: t.title,
      taskType: t.taskType,
      difficulty: t.difficulty,
      xpReward: t.xpReward,
      mySubmission: t.submissions[0] || null
    })),
    // Tier 3: Upcoming Quiz / Exam
    upcomingQuizOrExam: activeOrUpcomingExam
      ? {
          id: activeOrUpcomingExam.id,
          title: activeOrUpcomingExam.title,
          isQuiz: activeOrUpcomingExam.isQuiz,
          lesson: activeOrUpcomingExam.lesson,
          durationMinutes: activeOrUpcomingExam.durationMinutes,
          totalMarks: activeOrUpcomingExam.totalMarks,
          xpReward: activeOrUpcomingExam.xpReward,
          startsAt: activeOrUpcomingExam.startsAt,
          endsAt: activeOrUpcomingExam.endsAt,
          isStarted: now >= activeOrUpcomingExam.startsAt || activeOrUpcomingExam.isQuiz,
          myAttempt: activeOrUpcomingExam.attempts[0] || null
        }
      : null,
    activeExam: activeOrUpcomingExam
      ? {
          id: activeOrUpcomingExam.id,
          title: activeOrUpcomingExam.title,
          durationMinutes: activeOrUpcomingExam.durationMinutes,
          totalMarks: activeOrUpcomingExam.totalMarks,
          xpReward: activeOrUpcomingExam.xpReward,
          endsAt: activeOrUpcomingExam.endsAt,
          myAttempt: activeOrUpcomingExam.attempts[0] || null
        }
      : null,
    // Tier 4: Saturday Session (Attendance & QR unlock)
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
    // Tier 5: Progress & Meaningful Learning Analytics
    progress: progress.metrics,
    learningAnalytics: progress.learningAnalytics,
    counts: progress.counts,
    // Tier 6: XP & Achievements
    achievements: student.achievements.map((sa) => ({
      id: sa.achievement.id,
      name: sa.achievement.name,
      icon: sa.achievement.icon,
      unlockedAt: sa.unlockedAt
    })),
    // Tier 7: Leaderboard
    rank: myRankEntry ? { rank: myRankEntry.rank, monthlyXp: myRankEntry.monthlyXp } : null,
    leaderboardPreview: topPeers,
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
        learningAnalytics: progress.learningAnalytics,
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
    todayScheduledGroups,
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
    (async () => {
      const { getTodayScheduledGroups } = await import('../sessions/session.service.js');
      return getTodayScheduledGroups();
    })(),
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
    todayScheduledGroups,
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
