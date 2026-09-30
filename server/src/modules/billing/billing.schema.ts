import { z } from 'zod';

export const checkoutSchema = z.object({
  planId: z.string().optional(),
  paymentMethod: z.enum(['PAYMOB', 'VODAFONE_CASH', 'INSTAPAY']).default('PAYMOB')
});

export const verifyPaymentRedirectSchema = z.object({
  transactionId: z.string().optional(),
  txn: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  merchant_order_id: z.string().optional(),
  order: z.union([z.string(), z.number()]).optional(),
  success: z.union([z.boolean(), z.string()]).optional(),
  pending: z.union([z.boolean(), z.string()]).optional(),
  amount_cents: z.union([z.number(), z.string()]).optional(),
  hmac: z.string().optional()
}).passthrough();

export const submitManualPaymentSchema = z.object({
  senderPhone: z.string().max(30).optional(),
  referenceNumber: z.string().max(100).optional(),
  receiptUrl: z.string().max(10_000_000).optional(),
  notes: z.string().max(500).optional()
});

export const rejectManualPaymentSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500)
});

export const updatePaymentSettingsSchema = z.object({
  vodafoneCashNumber: z.string().max(30).optional(),
  vodafoneCashInstructions: z.string().max(1000).optional(),
  instaPayAddress: z.string().max(100).optional(),
  instaPayInstructions: z.string().max(1000).optional(),
  vodafoneCashEnabled: z.boolean().optional(),
  instaPayEnabled: z.boolean().optional(),
  paymobEnabled: z.boolean().optional()
});

export const bulkConfirmManualPaymentsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one transaction ID is required')
});

export const bulkRejectManualPaymentsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one transaction ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(500)
});

export const bulkPlanStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one plan ID is required'),
  isActive: z.boolean()
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().optional()
});

export const adminListSubscriptionsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'TRIALING']).optional(),
  studentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const adminListTransactionsQuerySchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REJECTED', 'REFUNDED', 'CANCELLED', 'EXPIRED']).optional(),
  studentId: z.string().uuid().optional(),
  provider: z.string().optional(),
  search: z.string().optional(),
  learningMode: z.enum(['ONLINE', 'HYBRID', 'ALL', 'NOT_SELECTED']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const adminRefundSchema = z.object({
  reason: z.string().min(1, 'Refund reason is required')
});

export const adminRecordManualPaymentSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
  amount: z.number().int().positive('Amount must be positive').optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional()
});

export const planBenefitSchema = z.object({
  id: z.string().min(1),
  textAr: z.string().min(1, 'Arabic benefit text is required'),
  textEn: z.string().optional().default(''),
  icon: z.string().max(50).default('check'),
  sortOrder: z.number().int().default(0)
});

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  code: z.string().min(2, 'Code is required').max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  description: z.string().max(500).optional(),
  price: z.number().int().positive('Price must be greater than zero'),
  currency: z.string().default('EGP'),
  billingInterval: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  isActive: z.boolean().default(true),
  targetGrade: z.enum(['ALL', 'GRADE_1', 'GRADE_2', 'GRADE_3']).optional(),
  targetGroup: z.string().max(100).optional().nullable(),
  features: z.array(planBenefitSchema).max(20).optional()
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_]+$/).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().int().positive().optional(),
  currency: z.string().optional(),
  billingInterval: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  isActive: z.boolean().optional(),
  targetGrade: z.enum(['ALL', 'GRADE_1', 'GRADE_2', 'GRADE_3']).optional(),
  targetGroup: z.string().max(100).optional().nullable(),
  features: z.array(planBenefitSchema).max(20).optional()
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type SubmitManualPaymentInput = z.infer<typeof submitManualPaymentSchema>;
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type AdminListSubscriptionsQuery = z.infer<typeof adminListSubscriptionsQuerySchema>;
export type AdminListTransactionsQuery = z.infer<typeof adminListTransactionsQuerySchema>;
export type AdminRefundInput = z.infer<typeof adminRefundSchema>;
export type AdminRecordManualPaymentInput = z.infer<typeof adminRecordManualPaymentSchema>;
export type PlanBenefitInput = z.infer<typeof planBenefitSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

