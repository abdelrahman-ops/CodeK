import { prisma } from '../../db/prisma.js';
import { hashToken } from '../../common/utils/crypto.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { AttendanceStatus, NotificationType, XPSourceType } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { createNotification } from '../notifications/notification.service.js';

const ATTENDANCE_XP = 10;

export async function confirmStudentAttendance(
  studentUserId: string,
  sessionId: string,
  rawToken: string
) {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId }
  });

  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      sessionLessons: {
        include: { lesson: true }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  if (session.status !== 'ACTIVE') {
    throw new BadRequestError('Attendance cannot be confirmed because this session is not active');
  }

  if (!session.tokenHash || !session.tokenExpiresAt) {
    throw new BadRequestError('Session does not have an active QR attendance token');
  }

  if (session.tokenExpiresAt < new Date()) {
    throw new BadRequestError('Attendance QR code has expired');
  }

  const tokenHash = hashToken(rawToken.trim());
  if (tokenHash !== session.tokenHash) {
    throw new BadRequestError('Invalid QR attendance code');
  }

  // Verify student is enrolled in the session's group
  const enrollment = await prisma.groupEnrollment.findFirst({
    where: {
      groupId: session.groupId,
      studentId: student.id,
      isActive: true
    }
  });

  if (!enrollment) {
    throw new ForbiddenError('You are not enrolled in the class group for this session');
  }

  // Atomic confirmation + idempotent XP award
  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId: student.id
        }
      },
      create: {
        sessionId,
        studentId: student.id,
        status: AttendanceStatus.PRESENT,
        isManual: false,
        studentConfirmedAt: new Date()
      },
      update: {
        status: AttendanceStatus.PRESENT,
        isManual: false,
        studentConfirmedAt: new Date()
      }
    });

    // Check if XP already awarded for this session
    const existingXP = await tx.xPTransaction.findUnique({
      where: {
        studentId_sourceType_sourceId: {
          studentId: student.id,
          sourceType: XPSourceType.ATTENDANCE,
          sourceId: sessionId
        }
      }
    });

    let xpAwarded = false;
    if (!existingXP) {
      await tx.xPTransaction.create({
        data: {
          studentId: student.id,
          amount: ATTENDANCE_XP,
          reason: `Session #${session.sessionNumber} Attendance`,
          sourceType: XPSourceType.ATTENDANCE,
          sourceId: sessionId
        }
      });

      // Update student total XP & streak
      await tx.student.update({
        where: { id: student.id },
        data: {
          totalXp: { increment: ATTENDANCE_XP },
          lastActiveDate: new Date()
        }
      });
      xpAwarded = true;
    }

    return { attendance, xpAwarded };
  });

  await createNotification({
    userId: studentUserId,
    title: 'Lesson Unlocked',
    message: `Your attendance for Session #${session.sessionNumber} is confirmed. Today's learning materials are now unlocked.`,
    type: NotificationType.LESSON_UNLOCKED
  });

  await createAuditLog({
    actorUserId: studentUserId,
    action: 'ATTENDANCE_CONFIRMED',
    entityType: 'Attendance',
    entityId: result.attendance.id,
    metadata: { sessionId, studentId: student.id, isManual: false }
  });

  return {
    attendance: result.attendance,
    xpAwarded: result.xpAwarded ? ATTENDANCE_XP : 0,
    unlockedLessons: session.sessionLessons.map((sl) => sl.lesson)
  };
}

export async function adminMarkAttendance(
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  notes?: string,
  actorUserId?: string
) {
  const [session, student] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.student.findUnique({ where: { id: studentId }, include: { user: true } })
  ]);

  if (!session) throw new NotFoundError('Session not found');
  if (!student) throw new NotFoundError('Student not found');

  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId
        }
      },
      create: {
        sessionId,
        studentId,
        status,
        isManual: true,
        adminConfirmedAt: new Date(),
        notes
      },
      update: {
        status,
        isManual: true,
        adminConfirmedAt: new Date(),
        notes
      }
    });

    if (status === AttendanceStatus.PRESENT) {
      const existingXP = await tx.xPTransaction.findUnique({
        where: {
          studentId_sourceType_sourceId: {
            studentId,
            sourceType: XPSourceType.ATTENDANCE,
            sourceId: sessionId
          }
        }
      });

      if (!existingXP) {
        await tx.xPTransaction.create({
          data: {
            studentId,
            amount: ATTENDANCE_XP,
            reason: `Session #${session.sessionNumber} Attendance (Admin Marked)`,
            sourceType: XPSourceType.ATTENDANCE,
            sourceId: sessionId
          }
        });

        await tx.student.update({
          where: { id: studentId },
          data: {
            totalXp: { increment: ATTENDANCE_XP },
            lastActiveDate: new Date()
          }
        });
      }
    }

    return attendance;
  });

  if (status === AttendanceStatus.PRESENT) {
    await createNotification({
      userId: student.userId,
      title: 'Attendance Marked',
      message: `Your attendance for Session #${session.sessionNumber} was confirmed by the instructor. Today's materials are now unlocked.`,
      type: NotificationType.LESSON_UNLOCKED
    });
  }

  await createAuditLog({
    actorUserId,
    action: 'ATTENDANCE_MANUALLY_MARKED',
    entityType: 'Attendance',
    entityId: result.id,
    metadata: { sessionId, studentId, status, notes }
  });

  return result;
}

export async function getSessionAttendanceList(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      group: {
        include: {
          enrollments: {
            where: { isActive: true },
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
                  }
                }
              }
            }
          }
        }
      },
      attendances: true
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const attendanceMap = new Map(session.attendances.map((a) => [a.studentId, a]));

  const roster = session.group.enrollments.map((e) => {
    const student = e.student;
    const att = attendanceMap.get(student.id);

    return {
      studentId: student.id,
      studentCode: student.studentCode,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      avatarUrl: student.user.avatarUrl,
      status: att ? att.status : AttendanceStatus.ABSENT,
      isManual: att ? att.isManual : false,
      studentConfirmedAt: att?.studentConfirmedAt || null,
      adminConfirmedAt: att?.adminConfirmedAt || null,
      notes: att?.notes || null
    };
  });

  const presentCount = roster.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const totalEnrolled = roster.length;

  return {
    sessionId: session.id,
    sessionNumber: session.sessionNumber,
    groupName: session.group.name,
    totalEnrolled,
    presentCount,
    absentCount: totalEnrolled - presentCount,
    roster
  };
}
