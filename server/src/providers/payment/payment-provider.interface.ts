/**
 * Provider-independent payment gateway interface.
 * Implementations are isolated behind this contract so that
 * Paymob can be swapped for Fawry, Kashier, or any future provider
 * without touching billing business logic.
 */

export interface PaymentIntention {
  intentionId: string;
  clientSecret: string;
  publicKey: string;
  redirectUrl?: string;
}

export interface WebhookVerificationResult {
  verified: boolean;
  eventId: string;
  eventType: string;
  transactionId: string;
  orderId: string;
  amount: number;         // In whole currency units (EGP)
  amountCents: number;    // In integer minor units (piasters)
  currency: string;
  success: boolean;
  rawPayload: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  providerResponse?: Record<string, any>;
}

export interface CreatePaymentIntentionParams {
  amount: number;           // In whole currency units (EGP), NOT piasters
  currency: string;
  orderId: string;          // Our PaymentTransaction.id
  studentName: string;
  studentEmail: string;
  notificationUrl: string;  // Webhook callback URL
  redirectUrl: string;      // Frontend redirect after payment
}

export interface IPaymentProvider {
  /** Human-readable provider name, e.g. "PAYMOB" */
  readonly name: string;

  /**
   * Create a payment intention/session on the provider side.
   * Returns a client_secret that the frontend uses to open checkout.
   */
  createPaymentIntention(params: CreatePaymentIntentionParams): Promise<PaymentIntention>;

  /**
   * Verify an incoming webhook signature and extract structured data.
   * Returns verified=false if HMAC doesn't match (caller should 403).
   */
  verifyWebhook(
    headers: Record<string, string>,
    body: any,
    query: Record<string, string>
  ): WebhookVerificationResult;

  /**
   * Request a refund from the provider.
   */
  refund(providerTransactionId: string, amount: number): Promise<RefundResult>;
}
