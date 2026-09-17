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

export async function listPayments(query: ListPaymentsQuery) {
  const { year, month, status, groupId, page, limit } = query;
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
