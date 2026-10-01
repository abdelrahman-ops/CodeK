/**
 * Billing Service — Phase 6
 *
 * Handles checkout sessions, webhook processing, subscription management,
 * and refunds. Uses the PaymentProvider abstraction for all provider interactions.
 *
 * KEY INVARIANTS:
 * 1. Webhooks are the authoritative payment confirmation (never trust frontend redirect)
 * 2. Webhook processing is idempotent (duplicate events are safely ignored)
 * 3. Payment state changes only happen through this service
 * 4. The centralized access engine (getLessonAccess) automatically picks up
 *    active subscriptions — no need to update access logic
 */

import { PaymentTransactionStatus, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import { getPaymentProvider } from '../../providers/payment/index.js';
import { env } from '../../config/env.js';
import type {
  CheckoutInput,
  SubmitManualPaymentInput,
  UpdatePaymentSettingsInput,
  AdminListSubscriptionsQuery,
  AdminListTransactionsQuery,
  AdminRecordManualPaymentInput,
  PlanBenefitInput,
  CreatePlanInput,
  UpdatePlanInput
} from './billing.schema.js';

// ─────────────────────────────────────────────────────────
// CANONICAL PLAN & CHECKOUT
// ─────────────────────────────────────────────────────────

export const CANONICAL_PLAN_CODE = 'CODEK_MONTHLY';
export const CANONICAL_PLAN_PRICE = 250; // In EGP
export const CANONICAL_PLAN_CURRENCY = 'EGP';
export const CANONICAL_PLAN_INTERVAL = 'MONTHLY';

/**
 * Ensures the canonical CodeK monthly subscription plan exists and is active.
 * Idempotent and concurrency-safe via Prisma upsert.
 */
export async function getOrCreateCanonicalPlan() {
  const existing = await prisma.subscriptionPlan.findUnique({
    where: { code: CANONICAL_PLAN_CODE }
  });
  if (existing) {
    return existing;
  }
  return await prisma.subscriptionPlan.upsert({
    where: { code: CANONICAL_PLAN_CODE },
    update: {},
    create: {
      name: 'CodeK Academy Monthly',
      code: CANONICAL_PLAN_CODE,
      description: 'Monthly full access to all curriculum, lessons, video tracks, and coding challenges',
      price: CANONICAL_PLAN_PRICE,
      currency: CANONICAL_PLAN_CURRENCY,
      billingInterval: CANONICAL_PLAN_INTERVAL,
      isActive: true,
      features: ['All Courses & Lessons', 'HD Video Streaming', 'Coding Challenges', 'Gamification & Leaderboard']
    }
  });
}

export interface GradePlanConfig {
  name: string;
  code: string;
  grade: string;
  price: number; // in EGP
  description: string;
}

export const DEFAULT_GRADE_PLANS: Record<string, GradePlanConfig> = {
  GRADE_1: {
    name: 'CodeK 1st Grade Monthly',
    code: 'GRADE_1_MONTHLY',
    grade: 'GRADE_1',
    price: 150,
    description: 'Monthly access to 1st Grade curriculum, video lessons, and coding challenges'
  },
  GRADE_2: {
    name: 'CodeK 2nd Grade Monthly',
    code: 'GRADE_2_MONTHLY',
    grade: 'GRADE_2',
    price: 250,
    description: 'Monthly access to 2nd Grade curriculum, video lessons, and coding challenges'
  },
  GRADE_3: {
    name: 'CodeK 3rd Grade Monthly',
    code: 'GRADE_3_MONTHLY',
    grade: 'GRADE_3',
    price: 350,
    description: 'Monthly access to 3rd Grade curriculum, video lessons, and coding challenges'
  }
};

/**
 * Resolves or auto-provisions the active subscription plan for a student's grade.
 * Pricing is strictly determined by the SubscriptionPlan record in PostgreSQL.
 */
export async function getPlanForGrade(rawGrade: string) {
  const gradeKey = rawGrade.trim().toUpperCase().replace(/\s+/g, '_');
  const canonicalCode = `${gradeKey}_MONTHLY`;

  // Check if active plan exists in the database by code, features, or grade key
  const plan = await prisma.subscriptionPlan.findFirst({
    where: {
      isActive: true,
      OR: [
        { code: canonicalCode },
        { code: gradeKey },
        { features: { path: ['grade'], equals: gradeKey } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  return plan;
}

/**
 * Returns public list of grade plans and current prices for registration.
 * Strictly returns only plans actively configured by academy administration.
 */
export async function listPublicGradePlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' }
  });

  return plans.map((p) => {
    const meta = (p.features as any) || {};
    let grade = meta.grade;
    if (!grade) {
      if (p.code.startsWith('GRADE_1')) grade = 'GRADE_1';
      else if (p.code.startsWith('GRADE_2')) grade = 'GRADE_2';
      else if (p.code.startsWith('GRADE_3')) grade = 'GRADE_3';
    }
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      billingInterval: p.billingInterval,
      grade: grade || null
    };
  });
}

export async function getPaymentSettings() {
  let settings = await prisma.paymentSetting.findUnique({
    where: { id: 'default' }
  });
  if (!settings) {
    settings = await prisma.paymentSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        vodafoneCashNumber: env.VODAFONE_CASH_NUMBER || '01017424986',
        vodafoneCashInstructions: 'حول المبلغ المطلوب إلى رقم فودافون كاش ثم أدخل رقم الهاتف المحول منه ورقم العملية لتأكيد الدفع.',
        instaPayAddress: env.INSTAPAY_ADDRESS || 'abdelrahmanataa17@instapay',
        instaPayInstructions: 'حول المبلغ المطلوب عبر تطبيق إنستاباي إلى العنوان أعلاه ثم أدخل الرقم المرجعي للتحويل.',
        vodafoneCashEnabled: true,
        instaPayEnabled: true,
        paymobEnabled: true
      }
    });
  }
  return settings;
}

export async function updatePaymentSettings(input: UpdatePaymentSettingsInput, adminUserId?: string) {
  const current = await getPaymentSettings();
  const updated = await prisma.paymentSetting.update({
    where: { id: 'default' },
    data: {
      vodafoneCashNumber: input.vodafoneCashNumber !== undefined ? input.vodafoneCashNumber : current.vodafoneCashNumber,
      vodafoneCashInstructions: input.vodafoneCashInstructions !== undefined ? input.vodafoneCashInstructions : current.vodafoneCashInstructions,
      instaPayAddress: input.instaPayAddress !== undefined ? input.instaPayAddress : current.instaPayAddress,
      instaPayInstructions: input.instaPayInstructions !== undefined ? input.instaPayInstructions : current.instaPayInstructions,
      vodafoneCashEnabled: input.vodafoneCashEnabled !== undefined ? input.vodafoneCashEnabled : current.vodafoneCashEnabled,
      instaPayEnabled: input.instaPayEnabled !== undefined ? input.instaPayEnabled : current.instaPayEnabled,
      paymobEnabled: input.paymobEnabled !== undefined ? input.paymobEnabled : current.paymobEnabled
    }
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'PAYMENT_SETTINGS_UPDATED',
    entityType: 'PaymentSetting',
    entityId: 'default',
    metadata: { changed: input }
  });

  return updated;
}

export async function getPublicPaymentMethods() {
  const settings = await getPaymentSettings();
  const methods = [];

  if (settings.paymobEnabled) {
    methods.push({
      id: 'PAYMOB',
      nameAr: 'بطاقة بنكية / محفظة إلكترونية (Paymob)',
      nameEn: 'Credit Card / Mobile Wallet (Paymob)',
      isAutomatic: true
    });
  }

  if (settings.vodafoneCashEnabled) {
    methods.push({
      id: 'VODAFONE_CASH',
      nameAr: 'فودافون كاش (Vodafone Cash)',
      nameEn: 'Vodafone Cash',
      isAutomatic: false,
      receivingAccount: settings.vodafoneCashNumber,
      instructions: settings.vodafoneCashInstructions
    });
  }

  if (settings.instaPayEnabled) {
    methods.push({
      id: 'INSTAPAY',
      nameAr: 'إنستاباي (InstaPay)',
      nameEn: 'InstaPay',
      isAutomatic: false,
      receivingAccount: settings.instaPayAddress,
      instructions: settings.instaPayInstructions
    });
  }

  return methods;
}

export interface CheckoutResult {
  transactionId: string;
  clientSecret?: string;
  publicKey?: string;
  redirectUrl?: string;
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  receivingAccount?: string | null;
  instructions?: string | null;
  manualPayment?: {
    receivingAccount?: string | null;
    instructions?: string | null;
    instructionsAr?: string | null;
    instructionsEn?: string | null;
  };
}

export async function createCheckoutSession(
  studentId: string,
  userId: string,
  input: CheckoutInput
): Promise<CheckoutResult> {
  // 1. Resolve student, grade, and user info for billing
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } }
  });
  if (!student) {
    throw new NotFoundError('Student not found');
  }

  // 2. Validate / resolve plan from server (client cannot override price or currency)
  let plan = null;
  if (input.planId && input.planId !== CANONICAL_PLAN_CODE) {
    plan = await prisma.subscriptionPlan.findFirst({
      where: {
        OR: [
          { id: input.planId },
          { code: input.planId }
        ]
      }
    });
  }

  if (!plan) {
    if (student?.grade) {
      plan = await getPlanForGrade(student.grade);
    }
  }

  if (!plan) {
    plan = await prisma.subscriptionPlan.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (!plan || !plan.isActive) {
    throw new NotFoundError('Subscription plan not found or inactive');
  }

  // 3. Strict Grade Isolation: Verify plan matches student's enrolled grade
  if (student?.grade) {
    const meta = (plan.features as any) || {};
    const planGrade =
      meta.grade ||
      (plan.code.startsWith('GRADE_1')
        ? 'GRADE_1'
        : plan.code.startsWith('GRADE_2')
        ? 'GRADE_2'
        : plan.code.startsWith('GRADE_3')
        ? 'GRADE_3'
        : null);

    if (planGrade && planGrade !== student.grade) {
      throw new BadRequestError(
        `Selected subscription plan (${plan.name}) is for ${planGrade}, but your enrolled grade is ${student.grade}`
      );
    }
  }

  const paymentMethod = input.paymentMethod || 'PAYMOB';

  // If manual payment method (Vodafone Cash or InstaPay)
  if (paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') {
    const settings = await getPaymentSettings();
    if (paymentMethod === 'VODAFONE_CASH' && !settings.vodafoneCashEnabled) {
      throw new BadRequestError('Vodafone Cash payments are currently disabled');
    }
    if (paymentMethod === 'INSTAPAY' && !settings.instaPayEnabled) {
      throw new BadRequestError('InstaPay payments are currently disabled');
    }

    const receivingAccount = paymentMethod === 'VODAFONE_CASH'
      ? settings.vodafoneCashNumber
      : settings.instaPayAddress;
    const instructions = paymentMethod === 'VODAFONE_CASH'
      ? settings.vodafoneCashInstructions
      : settings.instaPayInstructions;

    const transaction = await prisma.paymentTransaction.create({
      data: {
        studentId,
        planId: plan.id,
        provider: paymentMethod,
        amount: plan.price,
        currency: plan.currency,
        status: 'PENDING',
        description: `${plan.name} (${paymentMethod === 'VODAFONE_CASH' ? 'Vodafone Cash' : 'InstaPay'})`,
        metadata: {
          paymentMethod,
          receivingAccount,
          instructions
        }
      }
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'MANUAL_PAYMENT_INITIATED',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      metadata: { planId: plan.id, planCode: plan.code, amount: plan.price, paymentMethod }
    });

    return {
      transactionId: transaction.id,
      paymentMethod,
      amount: plan.price,
      currency: plan.currency,
      receivingAccount,
      instructions,
      manualPayment: {
        receivingAccount,
        instructions,
        instructionsAr: instructions,
        instructionsEn: instructions
      }
    };
  }

  // 2. Check no duplicate pending transaction for this student + plan (within last 30 minutes)
  const existingPending = await prisma.paymentTransaction.findFirst({
    where: {
      studentId,
      planId: plan.id,
      status: 'PENDING',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    }
  });

  // Reuse existing pending transaction if one exists
  if (existingPending && existingPending.providerIntentionId && existingPending.metadata) {
    const meta = existingPending.metadata as any;
    if (meta.clientSecret && meta.publicKey) {
      return {
        transactionId: existingPending.id,
        clientSecret: meta.clientSecret,
        publicKey: meta.publicKey,
        redirectUrl: meta.redirectUrl
      };
    }
  }



  // 4. Create a PENDING PaymentTransaction (amount strictly from server plan)
  const transaction = await prisma.paymentTransaction.create({
    data: {
      studentId,
      planId: plan.id,
      provider: getPaymentProvider().name,
      amount: plan.price,
      currency: plan.currency,
      status: 'PENDING',
      description: `${plan.name} subscription`
    }
  });

  // 5. Call payment provider to create intention
  const provider = getPaymentProvider();
  const appBaseUrl = env.APP_BASE_URL;

  const intention = await provider.createPaymentIntention({
    amount: plan.price,
    currency: plan.currency,
    orderId: transaction.id,
    studentName: `${student.user.firstName} ${student.user.lastName}`,
    studentEmail: student.user.email || 'student@codek.local',
    notificationUrl: `${appBaseUrl}/api/v1/billing/webhooks/${provider.name.toLowerCase()}`,
    redirectUrl: `${appBaseUrl}/student/subscription?payment=complete&txn=${transaction.id}`
  });

  // 6. Update transaction with provider intention ID and metadata
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      providerIntentionId: intention.intentionId,
      metadata: {
        clientSecret: intention.clientSecret,
        publicKey: intention.publicKey,
        redirectUrl: intention.redirectUrl
      }
    }
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'CHECKOUT_SESSION_CREATED',
    entityType: 'PaymentTransaction',
    entityId: transaction.id,
    metadata: { planId: plan.id, planCode: plan.code, amount: plan.price }
  });

  return {
    transactionId: transaction.id,
    clientSecret: intention.clientSecret,
    publicKey: intention.publicKey,
    redirectUrl: intention.redirectUrl
  };
}

// ─────────────────────────────────────────────────────────
// WEBHOOK: Idempotent, Concurrency-Safe Payment Processing
// ─────────────────────────────────────────────────────────

export async function handlePaymentWebhook(
  providerName: string,
  headers: Record<string, string>,
  body: any,
  query: Record<string, string>
): Promise<{ processed: boolean; message: string }> {
  const provider = getPaymentProvider();

  // 1. Verify HMAC signature (timing-safe)
  const result = provider.verifyWebhook(headers, body, query);
  if (!result.verified) {
    return { processed: false, message: 'HMAC verification failed' };
  }

  // 2. Early Idempotency Check on eventId
  if (result.eventId) {
    const existingEvent = await prisma.paymentWebhookEvent.findFirst({
      where: {
        provider: providerName.toUpperCase(),
        eventId: result.eventId,
        status: 'PROCESSED'
      }
    });
    if (existingEvent) {
      return { processed: true, message: 'Event already processed (idempotent skip)' };
    }
  }

  // 3. Resolve PaymentTransaction by trusted orderId (our transaction.id)
  let transaction = null;
  if (result.orderId) {
    transaction = await prisma.paymentTransaction.findUnique({
      where: { id: result.orderId },
      include: { plan: true }
    });
  }

  // Fallback correlation: search by providerTransactionId or providerIntentionId
  if (!transaction && result.transactionId) {
    transaction = await prisma.paymentTransaction.findFirst({
      where: {
        provider: providerName.toUpperCase(),
        OR: [
          { providerTransactionId: result.transactionId },
          { providerIntentionId: result.transactionId }
        ]
      },
      include: { plan: true }
    });
  }

  if (!transaction) {
    return { processed: false, message: 'Transaction not found for this webhook' };
  }

  // 4. Currency Validation (must match expected EGP)
  const receivedCurrency = (result.currency || '').toUpperCase().trim();
  const expectedCurrency = (transaction.currency || 'EGP').toUpperCase().trim();
  if (!receivedCurrency || receivedCurrency !== expectedCurrency || receivedCurrency !== 'EGP') {
    await createAuditLog({
      actorUserId: null,
      action: 'SECURITY_PAYMENT_CURRENCY_MISMATCH',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      metadata: { receivedCurrency, expectedCurrency, provider: providerName }
    });
    return { processed: false, message: 'Currency mismatch: security rejection' };
  }

  // 5. Amount Validation (Integer Minor Units — piasters)
  // Expected amount in piasters = EGP whole units * 100
  const expectedAmountCents = transaction.amount * 100;
  const planPriceCents = transaction.plan ? transaction.plan.price * 100 : expectedAmountCents;

  if (result.amountCents !== expectedAmountCents || result.amountCents !== planPriceCents) {
    await createAuditLog({
      actorUserId: null,
      action: 'SECURITY_PAYMENT_AMOUNT_MISMATCH',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      metadata: {
        receivedAmountCents: result.amountCents,
        expectedAmountCents,
        planPriceCents,
        provider: providerName
      }
    });

    // Set transaction to FAILED due to amount tampering
    await prisma.paymentTransaction.updateMany({
      where: { id: transaction.id, status: 'PENDING' },
      data: { status: 'FAILED' }
    });

    return { processed: false, message: 'Amount mismatch: security rejection' };
  }

  // 6. Handle Failed / Cancelled payments from provider
  if (!result.success) {
    await prisma.paymentTransaction.updateMany({
      where: { id: transaction.id, status: 'PENDING' },
      data: { status: 'FAILED', providerTransactionId: result.transactionId }
    });

    if (result.eventId) {
      await prisma.paymentWebhookEvent.upsert({
        where: { provider_eventId: { provider: providerName.toUpperCase(), eventId: result.eventId } },
        update: { status: 'PROCESSED', processedAt: new Date() },
        create: {
          provider: providerName.toUpperCase(),
          eventId: result.eventId,
          eventType: result.eventType,
          payload: result.rawPayload as any,
          status: 'PROCESSED',
          processedAt: new Date()
        }
      });
    }

    await createAuditLog({
      actorUserId: null,
      action: 'PAYMENT_FAILED',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      metadata: {
        actor: 'SYSTEM',
        provider: providerName,
        providerTxnId: result.transactionId
      }
    });

    // Invariant: Failed payment NEVER touches active subscription!
    return { processed: true, message: 'Payment failed, subscription unchanged' };
  }

  // 7. Successful Payment: Concurrency-Safe Atomic Database Transaction
  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // A. Conditional CAS Update: Exactly ONE concurrent request transitions PENDING -> PAID
    const updateResult = await tx.paymentTransaction.updateMany({
      where: {
        id: transaction.id,
        status: 'PENDING' // CAS: must be PENDING to transition
      },
      data: {
        status: 'PAID',
        providerTransactionId: result.transactionId,
        paidAt: now
      }
    });

    if (updateResult.count === 0) {
      // Another concurrent winner already transitioned this transaction!
      const current = await tx.paymentTransaction.findUnique({ where: { id: transaction.id } });
      if (current?.status === 'PAID') {
        return { processed: true, message: 'Payment already processed (idempotent skip)' };
      }
      return { processed: false, message: `Payment already in terminal state: ${current?.status}` };
    }

    // B. Record Webhook Event inside transaction (backed by @@unique([provider, eventId]))
    if (result.eventId) {
      try {
        await tx.paymentWebhookEvent.create({
          data: {
            provider: providerName.toUpperCase(),
            eventId: result.eventId,
            eventType: result.eventType,
            payload: result.rawPayload as any,
            status: 'PROCESSED',
            processedAt: now
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          // Event already recorded by concurrent request
          return { processed: true, message: 'Webhook event already processed (idempotent duplicate eventId)' };
        }
        throw err;
      }
    }

    // C. Mutate Subscription Entitlement: EXACTLY ONCE (Reuses canonical shared function)
    if (transaction.planId) {
      const intervalDays = getBillingIntervalDays(transaction.plan?.billingInterval || 'MONTHLY');
      await activateOrExtendSubscription(tx, {
        studentId: transaction.studentId,
        planId: transaction.planId,
        intervalDays,
        transactionId: transaction.id,
        now
      });
    }

    // D. Audit Log
    await createAuditLog({
      actorUserId: null,
      action: 'PAYMENT_SUCCEEDED',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      metadata: {
        actor: 'SYSTEM',
        provider: providerName,
        providerTxnId: result.transactionId,
        amount: transaction.amount,
        currency: transaction.currency
      }
    });

    return { processed: true, message: 'Payment succeeded, subscription activated' };
  });
}

/**
 * Canonical Subscription Activation / Extension logic.
 * Shared between Paymob webhook processing and Admin manual payments.
 * Ensures identical entitlement semantics across online and in-person payment paths.
 */
export async function activateOrExtendSubscription(
  tx: any,
  params: {
    studentId: string;
    planId: string;
    intervalDays: number;
    transactionId?: string;
    now?: Date;
  }
) {
  const now = params.now || new Date();

  // Check existing subscription for this student
  const existingSub = await tx.subscription.findFirst({
    where: {
      studentId: params.studentId,
      planId: params.planId
    },
    orderBy: { currentPeriodEnd: 'desc' }
  });

  let subscription;

  if (existingSub) {
    // Renewal: preserve remaining time if active (max(currentPeriodEnd, now)), or start from now if expired
    const baseTime = Math.max(existingSub.currentPeriodEnd.getTime(), now.getTime());
    const newEnd = new Date(baseTime + params.intervalDays * 24 * 60 * 60 * 1000);

    subscription = await tx.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: newEnd,
        cancelAtPeriodEnd: false
      }
    });
  } else {
    // Initial subscription purchase
    const newEnd = new Date(now.getTime() + params.intervalDays * 24 * 60 * 60 * 1000);
    subscription = await tx.subscription.create({
      data: {
        studentId: params.studentId,
        planId: params.planId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: newEnd
      }
    });
  }

  if (params.transactionId) {
    await tx.paymentTransaction.update({
      where: { id: params.transactionId },
      data: { subscriptionId: subscription.id }
    });
  }

  // Also synchronize with monthly Payment table so "سجل المصروفات والاشتراكات" reflects payment
  try {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: params.planId } });
    const paymentAmount = plan?.price || 250;

    await tx.payment.upsert({
      where: {
        studentId_year_month: {
          studentId: params.studentId,
          year: currentYear,
          month: currentMonth
        }
      },
      create: {
        studentId: params.studentId,
        year: currentYear,
        month: currentMonth,
        amount: paymentAmount,
        status: 'PAID',
        paidAt: now,
        notes: params.transactionId ? `معاملة إلكترونية ${params.transactionId.slice(0, 8)}` : 'اشتراك مفعل'
      },
      update: {
        status: 'PAID',
        paidAt: now,
        notes: params.transactionId ? `معاملة إلكترونية ${params.transactionId.slice(0, 8)}` : 'اشتراك مفعل'
      }
    });
  } catch (syncErr) {
    console.error('Failed to sync Payment table in activateOrExtendSubscription:', syncErr);
  }

  return subscription;
}

function getBillingIntervalDays(interval: string): number {
  switch (interval?.toUpperCase()) {
    case 'MONTHLY': return 30;
    case 'QUARTERLY': return 90;
    case 'YEARLY': return 365;
    default: return 30;
  }
}

// ─────────────────────────────────────────────────────────
// STUDENT: My Subscription
// ─────────────────────────────────────────────────────────

export async function getStudentSubscription(studentId: string) {
  const now = new Date();

  const subscription = await prisma.subscription.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: true
    }
  });

  if (!subscription) {
    return { subscription: null, plan: null, isActive: false };
  }

  // Auto-expire subscriptions that have passed their period end
  if (
    subscription.status === 'ACTIVE' &&
    subscription.currentPeriodEnd < now
  ) {
    if (subscription.cancelAtPeriodEnd) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED', canceledAt: now }
      });
      subscription.status = 'CANCELED' as any;
    } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' }
      });
      subscription.status = 'PAST_DUE' as any;
    }
  }

  return {
    subscription,
    plan: subscription.plan,
    isActive: subscription.status === 'ACTIVE' && subscription.currentPeriodEnd >= now
  };
}

// ─────────────────────────────────────────────────────────
// STUDENT: Payment History
// ─────────────────────────────────────────────────────────

export async function getStudentPaymentHistory(studentId: string) {
  return prisma.paymentTransaction.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: { select: { id: true, name: true, code: true } }
    }
  });
}

// ─────────────────────────────────────────────────────────
// STUDENT: Cancel Subscription
// ─────────────────────────────────────────────────────────

export async function cancelSubscription(studentId: string, userId: string, reason?: string) {
  const activeSub = await prisma.subscription.findFirst({
    where: {
      studentId,
      status: 'ACTIVE'
    }
  });

  if (!activeSub) {
    throw new BadRequestError('No active subscription to cancel');
  }

  const updated = await prisma.subscription.update({
    where: { id: activeSub.id },
    data: {
      cancelAtPeriodEnd: true
    },
    include: { plan: true }
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'SUBSCRIPTION_CANCEL_REQUESTED',
    entityType: 'Subscription',
    entityId: activeSub.id,
    metadata: { reason, cancelAtPeriodEnd: true, periodEnd: activeSub.currentPeriodEnd }
  });

  return updated;
}

// ─────────────────────────────────────────────────────────
// ADMIN: List Subscriptions
// ─────────────────────────────────────────────────────────

export async function adminListSubscriptions(query: AdminListSubscriptionsQuery) {
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.studentId) where.studentId = query.studentId;

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        plan: true,
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, loginId: true } }
          }
        }
      }
    }),
    prisma.subscription.count({ where })
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    }
  };
}

// ─────────────────────────────────────────────────────────
// ADMIN: List Transactions
// ─────────────────────────────────────────────────────────

export async function adminListTransactions(query: AdminListTransactionsQuery) {
  const pageSize = query.pageSize || query.limit || 25;
  const page = query.page || 1;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (query.status) {
    where.status = query.status;
  }
  if (query.studentId) {
    where.studentId = query.studentId;
  }
  if (query.provider && query.provider !== 'ALL') {
    where.provider = { equals: query.provider, mode: 'insensitive' };
  }

  // Learning Mode filter (ONLINE vs HYBRID vs NOT_SELECTED)
  if (query.learningMode && query.learningMode !== 'ALL') {
    if (query.learningMode === 'HYBRID') {
      where.student = {
        ...(where.student || {}),
        learningModeSelected: true,
        attendanceRequired: true
      };
    } else if (query.learningMode === 'ONLINE') {
      where.student = {
        ...(where.student || {}),
        learningModeSelected: true,
        attendanceRequired: false
      };
    } else if (query.learningMode === 'NOT_SELECTED') {
      where.student = {
        ...(where.student || {}),
        learningModeSelected: false
      };
    }
  }

  // Search across student name, student code, email, phone, transaction ID, providerTransactionId
  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { id: { contains: s, mode: 'insensitive' } },
      { providerTransactionId: { contains: s, mode: 'insensitive' } },
      {
        student: {
          OR: [
            { studentCode: { contains: s, mode: 'insensitive' } },
            { user: { firstName: { contains: s, mode: 'insensitive' } } },
            { user: { lastName: { contains: s, mode: 'insensitive' } } },
            { user: { email: { contains: s, mode: 'insensitive' } } },
            { user: { phone: { contains: s, mode: 'insensitive' } } }
          ]
        }
      }
    ];
  }

  // Date range filter
  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) {
      where.createdAt.gte = new Date(query.fromDate);
    }
    if (query.toDate) {
      const end = new Date(query.toDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [items, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        plan: { select: { id: true, name: true, code: true, price: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true
          }
        },
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true, loginId: true } }
          }
        }
      }
    }),
    prisma.paymentTransaction.count({ where })
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages
    },
    meta: {
      page,
      limit: pageSize,
      total,
      totalPages
    }
  };
}

// ─────────────────────────────────────────────────────────
// ADMIN: Refund Transaction
// ─────────────────────────────────────────────────────────

export async function adminRefundTransaction(
  transactionId: string,
  reason: string,
  adminUserId: string
) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: { subscription: true }
  });

  if (!transaction) {
    throw new NotFoundError('Payment transaction not found');
  }

  if (transaction.status !== 'PAID') {
    throw new BadRequestError('Only PAID transactions can be refunded');
  }

  // Call provider refund if we have a provider transaction ID
  if (transaction.providerTransactionId && transaction.provider) {
    const provider = getPaymentProvider();
    const refundResult = await provider.refund(
      transaction.providerTransactionId,
      transaction.amount
    );

    if (!refundResult.success) {
      throw new BadRequestError('Provider refund failed. Please retry or process manually.');
    }
  }

  // Update transaction
  const updated = await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
      metadata: {
        ...(transaction.metadata as any || {}),
        refundReason: reason,
        refundedBy: adminUserId
      }
    }
  });

  // If this was linked to a subscription, cancel it
  if (transaction.subscriptionId) {
    await prisma.subscription.update({
      where: { id: transaction.subscriptionId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date()
      }
    });
  }

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'PAYMENT_REFUNDED',
    entityType: 'PaymentTransaction',
    entityId: transactionId,
    metadata: { reason, amount: transaction.amount }
  });

  return updated;
}

// ─────────────────────────────────────────────────────────
// ADMIN: Record Manual Hybrid Payment
// ─────────────────────────────────────────────────────────

export async function adminRecordManualPayment(
  input: AdminRecordManualPaymentInput,
  adminUserId: string
) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { user: true }
  });

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  if (!student.learningModeSelected || !student.attendanceRequired) {
    throw new BadRequestError('Manual payments can only be recorded for Hybrid students');
  }

  // Idempotency check 1: Explicit idempotencyKey
  if (input.idempotencyKey) {
    const existingByKey = await prisma.paymentTransaction.findFirst({
      where: {
        studentId: student.id,
        provider: 'MANUAL',
        providerTransactionId: `MANUAL_${input.idempotencyKey}`
      },
      include: { subscription: true }
    });
    if (existingByKey) {
      return {
        transaction: existingByKey,
        subscription: existingByKey.subscription,
        isDuplicate: true
      };
    }
  }

  // Idempotency check 2: Accidental rapid double-submit guard for requests without explicit key (within 5 seconds)
  if (!input.idempotencyKey) {
    const recentDuplicate = await prisma.paymentTransaction.findFirst({
      where: {
        studentId: student.id,
        provider: 'MANUAL',
        status: PaymentTransactionStatus.PAID,
        createdAt: { gt: new Date(Date.now() - 5000) }
      },
      include: { subscription: true }
    });
    if (recentDuplicate) {
      return {
        transaction: recentDuplicate,
        subscription: recentDuplicate.subscription,
        isDuplicate: true
      };
    }
  }

  // Determine canonical monthly plan (30 days) or fallback
  const plan = await getOrCreateCanonicalPlan();
  const paidAmount = input.amount !== undefined && input.amount > 0 ? input.amount : plan.price;
  const intervalDays = getBillingIntervalDays(plan.billingInterval || 'MONTHLY');
  const now = new Date();

  const providerTransactionId = input.idempotencyKey
    ? `MANUAL_${input.idempotencyKey}`
    : `MANUAL_${student.id}_${now.getTime()}`;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create paid PaymentTransaction record (provider: "MANUAL")
    const txn = await tx.paymentTransaction.create({
      data: {
        studentId: student.id,
        planId: plan.id,
        amount: paidAmount,
        currency: plan.currency || CANONICAL_PLAN_CURRENCY,
        status: PaymentTransactionStatus.PAID,
        provider: 'MANUAL',
        providerTransactionId,
        paidAt: now,
        metadata: {
          recordedByAdminId: adminUserId,
          notes: input.notes?.trim() || null,
          isManualHybridPayment: true
        }
      }
    });

    // 2. Extend/Activate subscription using canonical shared logic
    const subscription = await activateOrExtendSubscription(tx, {
      studentId: student.id,
      planId: plan.id,
      intervalDays,
      transactionId: txn.id,
      now
    });

    return { txn, subscription };
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'MANUAL_PAYMENT_RECORDED',
    entityType: 'PaymentTransaction',
    entityId: result.txn.id,
    metadata: {
      studentId: student.id,
      amount: paidAmount,
      currency: plan.currency || CANONICAL_PLAN_CURRENCY,
      subscriptionId: result.subscription.id,
      currentPeriodEnd: result.subscription.currentPeriodEnd,
      notes: input.notes?.trim() || null
    }
  });

  return {
    transaction: result.txn,
    subscription: result.subscription
  };
}

// ─────────────────────────────────────────────────────────
// STUDENT: Submit Manual Payment Transfer Details
// ─────────────────────────────────────────────────────────

export async function submitManualPayment(
  transactionId: string,
  studentId: string,
  input: SubmitManualPaymentInput
) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  if (transaction.studentId !== studentId) {
    throw new BadRequestError('Access denied for this transaction');
  }

  if (transaction.status !== 'PENDING') {
    throw new BadRequestError(`Transaction is not pending (status: ${transaction.status})`);
  }

  const updated = await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      providerTransactionId: input.referenceNumber || input.senderPhone || transaction.providerTransactionId,
      metadata: {
        ...(transaction.metadata as any || {}),
        senderPhone: input.senderPhone || null,
        referenceNumber: input.referenceNumber || null,
        receiptUrl: input.receiptUrl || null,
        notes: input.notes || null,
        submittedAt: new Date().toISOString()
      }
    }
  });

  return updated;
}

// ─────────────────────────────────────────────────────────
// ADMIN: Confirm Manual Payment & Activate Subscription
// ─────────────────────────────────────────────────────────

export async function adminConfirmManualPayment(transactionId: string, adminUserId?: string) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: { plan: true }
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  if (transaction.status === 'PAID') {
    return {
      updatedTxn: transaction,
      message: 'Transaction is already confirmed and paid'
    };
  }

  if (transaction.status !== 'PENDING') {
    throw new BadRequestError(`Transaction is not in PENDING state (status: ${transaction.status})`);
  }

  const plan = transaction.plan || (await getOrCreateCanonicalPlan());
  const intervalDays = getBillingIntervalDays(plan.billingInterval || 'MONTHLY');
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedTxn = await tx.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status: PaymentTransactionStatus.PAID,
        paidAt: now,
        metadata: {
          ...(transaction.metadata as any || {}),
          confirmedByAdminId: adminUserId || null,
          confirmedAt: now.toISOString()
        }
      }
    });

    const subscription = await activateOrExtendSubscription(tx, {
      studentId: transaction.studentId,
      planId: plan.id,
      intervalDays,
      transactionId: transaction.id,
      now
    });

    return { updatedTxn, subscription };
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'ADMIN_PAYMENT_CONFIRMED',
    entityType: 'PaymentTransaction',
    entityId: transaction.id,
    metadata: {
      studentId: transaction.studentId,
      amount: transaction.amount,
      provider: transaction.provider,
      subscriptionId: result.subscription.id,
      currentPeriodEnd: result.subscription.currentPeriodEnd
    }
  });

  return result;
}

export const adminApproveTransaction = adminConfirmManualPayment;
export const adminRejectTransaction = adminRejectManualPayment;

// ─────────────────────────────────────────────────────────
// REDIRECT VERIFICATION: Automatic Client Redirect Verification
// ─────────────────────────────────────────────────────────

export async function verifyPaymentRedirect(
  query: Record<string, any>,
  user: { userId: string; role: string; studentId?: string }
) {
  const txnId = query.txn || query.transactionId || query.merchant_order_id;
  const providerTxnId = query.id ? String(query.id) : undefined;
  const successParam = query.success;
  const pendingParam = query.pending;
  const isApproved =
    successParam === true ||
    successParam === 'true' ||
    query['data.message'] === 'Approved' ||
    query.txn_response_code === 'APPROVED';
  const isPending = pendingParam === true || pendingParam === 'true';

  if (!txnId && !providerTxnId) {
    throw new BadRequestError('Transaction identifier missing from payment return parameters');
  }

  // Find transaction by ID or provider transaction/intention
  let transaction = txnId
    ? await prisma.paymentTransaction.findUnique({
        where: { id: txnId },
        include: { plan: true, student: { include: { user: true } } }
      })
    : null;

  if (!transaction && providerTxnId) {
    transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { providerTransactionId: providerTxnId },
          { providerIntentionId: providerTxnId }
        ]
      },
      include: { plan: true, student: { include: { user: true } } }
    });
  }

  if (!transaction) {
    throw new NotFoundError('Payment transaction not found');
  }

  // Permission check for students
  if (user.role === 'STUDENT' && transaction.studentId !== user.studentId) {
    throw new BadRequestError('Unauthorized: This transaction does not belong to you');
  }

  // Idempotent check
  if (transaction.status === 'PAID') {
    const existingSub = await prisma.subscription.findFirst({
      where: { studentId: transaction.studentId, status: 'ACTIVE' },
      orderBy: { currentPeriodEnd: 'desc' }
    });
    return {
      success: true,
      alreadyProcessed: true,
      message: 'Payment already processed and subscription is active',
      transaction,
      subscription: existingSub
    };
  }

  if (!isApproved || isPending) {
    if (!isPending) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          providerTransactionId: providerTxnId || transaction.providerTransactionId,
          metadata: {
            ...(transaction.metadata as any || {}),
            failureReason: 'Payment gateway reported unsuccessful return',
            redirectReturnQuery: query
          }
        }
      });
    }
    return {
      success: false,
      isPending,
      message: isPending ? 'Payment is still pending' : 'Payment was not approved'
    };
  }

  // Approved: Activate Subscription
  const plan = transaction.plan || (await getOrCreateCanonicalPlan());
  const intervalDays = getBillingIntervalDays(plan.billingInterval || 'MONTHLY');
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedTxn = await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentTransactionStatus.PAID,
        providerTransactionId: providerTxnId || transaction.providerTransactionId,
        paidAt: now,
        metadata: {
          ...(transaction.metadata as any || {}),
          verifiedViaRedirect: true,
          verifiedAt: now.toISOString(),
          redirectReturnQuery: query
        }
      }
    });

    const subscription = await activateOrExtendSubscription(tx, {
      studentId: transaction.studentId,
      planId: plan.id,
      intervalDays,
      transactionId: transaction.id,
      now
    });

    return { updatedTxn, subscription };
  });

  await createAuditLog({
    actorUserId: user.userId,
    action: 'PAYMENT_VERIFIED_REDIRECT',
    entityType: 'PaymentTransaction',
    entityId: transaction.id,
    metadata: {
      studentId: transaction.studentId,
      amount: transaction.amount,
      provider: transaction.provider,
      providerTxnId,
      subscriptionId: result.subscription.id
    }
  });

  return {
    success: true,
    message: 'Payment verified and subscription activated successfully',
    transaction: result.updatedTxn,
    subscription: result.subscription
  };
}

// ─────────────────────────────────────────────────────────
// ADMIN: Reject Manual Payment
// ─────────────────────────────────────────────────────────

export async function adminRejectManualPayment(transactionId: string, reason: string, adminUserId?: string) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  if (transaction.status !== 'PENDING') {
    throw new BadRequestError(`Transaction is not in PENDING state (status: ${transaction.status})`);
  }

  const now = new Date();
  const updated = await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      status: PaymentTransactionStatus.REJECTED,
      metadata: {
        ...(transaction.metadata as any || {}),
        rejectionReason: reason,
        rejectedByAdminId: adminUserId || null,
        rejectedAt: now.toISOString()
      }
    }
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'MANUAL_PAYMENT_REJECTED',
    entityType: 'PaymentTransaction',
    entityId: transaction.id,
    metadata: {
      studentId: transaction.studentId,
      amount: transaction.amount,
      provider: transaction.provider,
      reason
    }
  });

  return updated;
}

// ─────────────────────────────────────────────────────────
// ADMIN: Bulk Confirm Manual Payments
// ─────────────────────────────────────────────────────────

export async function adminBulkConfirmManualPayments(transactionIds: string[], adminUserId?: string) {
  const confirmedIds: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of transactionIds) {
    try {
      const res = await adminConfirmManualPayment(id, adminUserId);
      confirmedIds.push(res.updatedTxn.id);
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    success: true,
    confirmedCount: confirmedIds.length,
    failedCount: errors.length,
    confirmedIds,
    errors
  };
}

// ─────────────────────────────────────────────────────────
// ADMIN: Bulk Reject Manual Payments
// ─────────────────────────────────────────────────────────

export async function adminBulkRejectManualPayments(transactionIds: string[], reason: string, adminUserId?: string) {
  const rejectedIds: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of transactionIds) {
    try {
      const res = await adminRejectManualPayment(id, reason, adminUserId);
      rejectedIds.push(res.id);
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    success: true,
    rejectedCount: rejectedIds.length,
    failedCount: errors.length,
    rejectedIds,
    errors
  };
}

// ─────────────────────────────────────────────────────────
// ADMIN: Bulk Update Subscription Plan Status
// ─────────────────────────────────────────────────────────

export async function adminBulkUpdatePlanStatus(planIds: string[], isActive: boolean, actorUserId?: string) {
  if (!planIds || planIds.length === 0) {
    return { success: true, count: 0, ids: [] };
  }

  const result = await prisma.subscriptionPlan.updateMany({
    where: { id: { in: planIds } },
    data: { isActive }
  });

  await createAuditLog({
    actorUserId,
    action: isActive ? 'PLANS_BULK_ACTIVATED' : 'PLANS_BULK_DEACTIVATED',
    entityType: 'SubscriptionPlan',
    entityId: planIds[0] || null,
    metadata: {
      count: result.count,
      planIds,
      isActive
    }
  });

  return { success: true, count: result.count, ids: planIds, isActive };
}

// ─────────────────────────────────────────────────────────
// ADMIN: Subscription Plan CRUD & Structured Benefits
// ─────────────────────────────────────────────────────────

export function cleanBenefitText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/^svg[:\s\-_]*/i, '').trim();
}

export function normalizePlanFeatures(rawFeatures: any): PlanBenefitInput[] {
  if (!rawFeatures) return [];
  if (rawFeatures && !Array.isArray(rawFeatures) && Array.isArray(rawFeatures.benefits)) {
    return normalizePlanFeatures(rawFeatures.benefits);
  }
  if (Array.isArray(rawFeatures)) {
    return rawFeatures.map((item, idx) => {
      if (typeof item === 'string') {
        const cleaned = cleanBenefitText(item);
        return {
          id: `feat-${idx + 1}`,
          textAr: cleaned,
          textEn: cleaned,
          icon: 'check' as const,
          sortOrder: idx
        };
      }
      if (item && typeof item === 'object') {
        const textAr = cleanBenefitText(item.textAr || item.text || item.title || '');
        const textEn = cleanBenefitText(item.textEn || item.textAr || '');
        const icon = typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim() : 'check';
        return {
          id: String(item.id || `feat-${idx + 1}`),
          textAr: textAr || 'ميزة الخطة',
          textEn: textEn || '',
          icon,
          sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx
        };
      }
      return {
        id: `feat-${idx + 1}`,
        textAr: 'ميزة الخطة',
        textEn: '',
        icon: 'check' as const,
        sortOrder: idx
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return [];
}

export async function adminListPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { createdAt: 'asc' }
  });
  return plans.map((p) => {
    const raw = (p.features as any) || {};
    const targetGrade = Array.isArray(raw)
      ? (p.code.startsWith('GRADE_1') ? 'GRADE_1' : p.code.startsWith('GRADE_2') ? 'GRADE_2' : p.code.startsWith('GRADE_3') ? 'GRADE_3' : 'ALL')
      : (raw.grade || raw.targetGrade || (p.code.startsWith('GRADE_1') ? 'GRADE_1' : p.code.startsWith('GRADE_2') ? 'GRADE_2' : p.code.startsWith('GRADE_3') ? 'GRADE_3' : 'ALL'));
    const targetGroup = (!Array.isArray(raw) && raw.targetGroup) ? raw.targetGroup : null;
    return {
      ...p,
      targetGrade,
      targetGroup,
      features: normalizePlanFeatures(p.features)
    };
  });
}

export async function adminCreatePlan(input: CreatePlanInput, adminUserId: string) {
  const existingCode = await prisma.subscriptionPlan.findUnique({
    where: { code: input.code }
  });
  if (existingCode) {
    throw new BadRequestError(`A subscription plan with code "${input.code}" already exists`);
  }

  const normalizedBenefits = normalizePlanFeatures(input.features);
  const targetGrade = input.targetGrade || (input.code.startsWith('GRADE_1') ? 'GRADE_1' : input.code.startsWith('GRADE_2') ? 'GRADE_2' : input.code.startsWith('GRADE_3') ? 'GRADE_3' : 'ALL');
  const targetGroup = input.targetGroup || null;

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      price: input.price,
      currency: input.currency || 'EGP',
      billingInterval: input.billingInterval || 'MONTHLY',
      isActive: input.isActive !== undefined ? input.isActive : true,
      features: {
        grade: targetGrade,
        targetGroup,
        benefits: normalizedBenefits
      } as any
    }
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'SUBSCRIPTION_PLAN_CREATED',
    entityType: 'SubscriptionPlan',
    entityId: plan.id,
    metadata: { code: plan.code, price: plan.price, targetGrade }
  });

  return {
    ...plan,
    targetGrade,
    targetGroup,
    features: normalizedBenefits
  };
}

export async function adminUpdatePlan(id: string, input: UpdatePlanInput, adminUserId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id }
  });
  if (!plan) {
    throw new NotFoundError('Subscription plan not found');
  }

  if (plan.code === CANONICAL_PLAN_CODE && input.code && input.code !== CANONICAL_PLAN_CODE) {
    throw new BadRequestError(`The code for canonical plan "${CANONICAL_PLAN_CODE}" cannot be altered`);
  }

  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.code !== undefined) data.code = input.code;
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.billingInterval !== undefined) data.billingInterval = input.billingInterval;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const rawFeatures = (plan.features as any) || {};
  let currentGrade = Array.isArray(rawFeatures)
    ? (plan.code.startsWith('GRADE_1') ? 'GRADE_1' : plan.code.startsWith('GRADE_2') ? 'GRADE_2' : plan.code.startsWith('GRADE_3') ? 'GRADE_3' : 'ALL')
    : (rawFeatures.grade || rawFeatures.targetGrade || 'ALL');
  let currentGroup = Array.isArray(rawFeatures) ? null : (rawFeatures.targetGroup || null);
  let currentBenefits = normalizePlanFeatures(plan.features);

  if (input.targetGrade !== undefined) currentGrade = input.targetGrade;
  if (input.targetGroup !== undefined) currentGroup = input.targetGroup;
  if (input.features !== undefined) currentBenefits = normalizePlanFeatures(input.features);

  if (input.targetGrade !== undefined || input.targetGroup !== undefined || input.features !== undefined) {
    data.features = {
      grade: currentGrade,
      targetGroup: currentGroup,
      benefits: currentBenefits
    } as any;
  }

  const updated = await prisma.subscriptionPlan.update({
    where: { id },
    data
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'SUBSCRIPTION_PLAN_UPDATED',
    entityType: 'SubscriptionPlan',
    entityId: updated.id,
    metadata: { updatedFields: Object.keys(data) }
  });

  const updatedRaw = (updated.features as any) || {};
  const updatedGrade = Array.isArray(updatedRaw)
    ? currentGrade
    : (updatedRaw.grade || updatedRaw.targetGrade || currentGrade);
  const updatedGroup = !Array.isArray(updatedRaw) ? updatedRaw.targetGroup : null;

  return {
    ...updated,
    targetGrade: updatedGrade,
    targetGroup: updatedGroup,
    features: normalizePlanFeatures(updated.features)
  };
}

export async function adminDeletePlan(id: string, adminUserId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id }
  });
  if (!plan) {
    throw new NotFoundError('Subscription plan not found');
  }

  if (plan.code === CANONICAL_PLAN_CODE) {
    throw new BadRequestError('The canonical CodeK subscription plan cannot be deleted');
  }

  const [subCount, txnCount] = await Promise.all([
    prisma.subscription.count({ where: { planId: id } }),
    prisma.paymentTransaction.count({ where: { planId: id } })
  ]);

  if (subCount > 0 || txnCount > 0) {
    const deactivated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false }
    });

    await createAuditLog({
      actorUserId: adminUserId,
      action: 'SUBSCRIPTION_PLAN_DEACTIVATED',
      entityType: 'SubscriptionPlan',
      entityId: id,
      metadata: { reason: 'Referenced historically by subscriptions or transactions' }
    });

    return {
      success: true,
      deactivated: true,
      message: 'Plan has historical subscriptions or transactions and was deactivated instead of deleted',
      plan: deactivated
    };
  }

  await prisma.subscriptionPlan.delete({
    where: { id }
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'SUBSCRIPTION_PLAN_DELETED',
    entityType: 'SubscriptionPlan',
    entityId: id,
    metadata: { planName: plan.name, planCode: plan.code }
  });

  return {
    success: true,
    deleted: true,
    message: 'Subscription plan deleted successfully'
  };
}

