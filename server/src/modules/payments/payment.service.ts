import { prisma } from '../../db/prisma.js';
import { ListPaymentsQuery, RecordPaymentInput, UpdatePaymentInput } from './payment.schema.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { PaymentStatus, Role } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';

export async function recordPayment(input: RecordPaymentInput, actorUserId?: string) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { user: true }
  });

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  const isPaid = input.status === PaymentStatus.PAID;

  const payment = await prisma.payment.upsert({
    where: {
      studentId_year_month: {
        studentId: input.studentId,
        year: input.year,
        month: input.month
      }
    },
    create: {
      studentId: input.studentId,
      year: input.year,
      month: input.month,
      amount: input.amount,
      status: input.status,
      paidAt: isPaid ? new Date() : null,
      notes: input.notes
    },
    update: {
      amount: input.amount,
      status: input.status,
      paidAt: isPaid ? new Date() : null,
      notes: input.notes
    }
  });

  if (isPaid) {
    try {
      const activeSub = await prisma.subscription.findFirst({
        where: { studentId: input.studentId, status: 'ACTIVE' }
      });
      if (!activeSub) {
        const canonicalPlan = await prisma.subscriptionPlan.findFirst({
          where: { isActive: true }
        });
        if (canonicalPlan) {
          const now = new Date();
          const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          await prisma.subscription.create({
            data: {
              studentId: input.studentId,
              planId: canonicalPlan.id,
              status: 'ACTIVE',
              currentPeriodStart: now,
              currentPeriodEnd: end
            }
          });
        }
      }
    } catch (subErr) {
      console.error('Failed to sync subscription in recordPayment:', subErr);
    }
  }

  await createAuditLog({
    actorUserId,
    action: isPaid ? 'PAYMENT_MARKED_PAID' : 'PAYMENT_MARKED_UNPAID',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: {
      studentId: input.studentId,
      year: input.year,
      month: input.month,
      amount: input.amount,
      status: input.status
    }
  });

  return payment;
}

/**
 * Ensures all active students have a monthly payment ledger record for the given year/month.
 * If student has an active subscription or paid transaction for this month, sets status to PAID.
 * Otherwise sets status to UNPAID with the default grade/plan fee.
 */
async function ensureMonthlyStudentRecords(year: number, month: number, groupId?: string) {
  try {
    const students = await prisma.student.findMany({
      where: {
        user: { isActive: true },
        ...(groupId ? {
          enrollments: { some: { groupId, isActive: true } }
        } : {})
      },
      include: {
        user: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true }
        }
      }
    });

    if (students.length === 0) return;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true }
    });

    for (const student of students) {
      const existing = await prisma.payment.findUnique({
        where: {
          studentId_year_month: {
            studentId: student.id,
            year,
            month
          }
        }
      });

      const paidTxn = await prisma.paymentTransaction.findFirst({
        where: {
          studentId: student.id,
          status: 'PAID',
          paidAt: { gte: monthStart, lte: monthEnd }
        },
        include: { plan: true }
      });

      const activeSub = student.subscriptions.find(s =>
        s.currentPeriodStart <= monthEnd && s.currentPeriodEnd >= monthStart
      );

      let fee = 250;
      if (student.grade) {
        const gradePlan = plans.find(p => (p.features as any)?.grade === student.grade);
        if (gradePlan) fee = gradePlan.price;
      } else if (plans.length > 0 && plans[0]) {
        fee = plans[0].price;
      }

      if (!existing) {
        if (paidTxn || activeSub) {
          await prisma.payment.create({
            data: {
              studentId: student.id,
              year,
              month,
              amount: paidTxn?.amount || activeSub?.plan?.price || fee,
              status: PaymentStatus.PAID,
              paidAt: paidTxn?.paidAt || activeSub?.currentPeriodStart || new Date(),
              notes: paidTxn ? `دفع إلكتروني (${paidTxn.provider})` : 'اشتراك مفعل'
            }
          });
        } else {
          await prisma.payment.create({
            data: {
              studentId: student.id,
              year,
              month,
              amount: fee,
              status: PaymentStatus.UNPAID,
              paidAt: null,
              notes: null
            }
          });
        }
      } else if (existing.status === PaymentStatus.UNPAID && (paidTxn || activeSub)) {
        await prisma.payment.update({
          where: { id: existing.id },
          data: {
            status: PaymentStatus.PAID,
            amount: paidTxn?.amount || activeSub?.plan?.price || existing.amount,
            paidAt: paidTxn?.paidAt || new Date(),
            notes: paidTxn ? `دفع إلكتروني (${paidTxn.provider})` : 'اشتراك مفعل'
          }
        });
      }
    }
  } catch (err) {
    console.error('Error ensuring monthly student payment records:', err);
  }
}

export async function listPayments(query: ListPaymentsQuery) {
  const { year, month, status, groupId, page, limit } = query;

  if (year && month) {
    await ensureMonthlyStudentRecords(year, month, groupId);
  }

  const skip = (page - 1) * limit;

  const where = {
    ...(year ? { year } : {}),
    ...(month ? { month } : {}),
    ...(status ? { status } : {}),
    ...(groupId
      ? {
          student: {
            enrollments: {
              some: { groupId, isActive: true }
            }
          }
        }
      : {})
  };

  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                loginId: true,
                firstName: true,
                lastName: true,
                phone: true
              }
            },
            enrollments: {
              where: { isActive: true },
              include: { group: { select: { id: true, name: true } } }
            }
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

export async function getPaymentSummary(year?: number, month?: number) {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  const currentMonth = month || now.getMonth() + 1;

  await ensureMonthlyStudentRecords(currentYear, currentMonth);

  const grouped = await prisma.payment.groupBy({
    by: ['status'],
    where: {
      year: currentYear,
      month: currentMonth
    },
    _sum: {
      amount: true
    },
    _count: {
      _all: true
    }
  });

  let totalRecords = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let totalCollectedEgp = 0;
  let totalExpectedEgp = 0;

  for (const g of grouped) {
    const count = g._count._all;
    const sum = g._sum.amount ?? 0;
    totalRecords += count;
    totalExpectedEgp += sum;

    if (g.status === PaymentStatus.PAID) {
      paidCount = count;
      totalCollectedEgp = sum;
    } else if (g.status === PaymentStatus.UNPAID) {
      unpaidCount = count;
    }
  }

  return {
    year: currentYear,
    month: currentMonth,
    totalRecords,
    paidCount,
    unpaidCount,
    totalCollectedEgp,
    totalExpectedEgp
  };
}

export async function getStudentPayments(
  studentId: string,
  requestUser: { userId: string; role: Role; studentId?: string; parentId?: string }
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      parents: true
    }
  });

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  // Authorization check (IDOR Protection)
  if (requestUser.role === Role.ADMIN) {
    // Admin can access any student's payments
  } else if (requestUser.role === Role.STUDENT && requestUser.studentId === studentId) {
    // Student can access their own payments
  } else if (requestUser.role === Role.PARENT && requestUser.parentId) {
    // Parent can only access if linked to student
    const isLinked = student.parents.some((p) => p.parentId === requestUser.parentId);
    if (!isLinked) {
      throw new ForbiddenError('You do not have permission to view payment records for this student');
    }
  } else {
    throw new ForbiddenError('You do not have permission to view payment records for this student');
  }

  return prisma.payment.findMany({
    where: { studentId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  });
}

export async function bulkUpdatePaymentStatus(
  paymentIds: string[],
  status: PaymentStatus,
  notes?: string | null,
  actorUserId?: string
) {
  const result = await prisma.payment.updateMany({
    where: { id: { in: paymentIds } },
    data: {
      status,
      paidAt: status === PaymentStatus.PAID ? new Date() : null,
      ...(notes !== undefined ? { notes } : {})
    }
  });

  await createAuditLog({
    actorUserId,
    action: `PAYMENTS_BULK_${status}`,
    entityType: 'Payment',
    entityId: paymentIds[0] || null,
    metadata: { count: result.count, paymentIds, status, notes }
  });

  return {
    success: true,
    count: result.count,
    paymentIds
  };
}
