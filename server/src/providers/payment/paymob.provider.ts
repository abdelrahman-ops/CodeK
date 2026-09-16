/**
 * Paymob (Accept) Payment Provider — Egypt
 *
 * Integration method: Intention API (v1)
 * Checkout: Embedded Pixel or Hosted Redirect
 * Webhook: HMAC-SHA512 verification
 *
 * Amounts are converted to piasters (×100) for Paymob API calls.
 * Docs: https://developers.paymob.com/
 */

import crypto from 'crypto';
import {
  IPaymentProvider,
  PaymentIntention,
  WebhookVerificationResult,
  RefundResult,
  CreatePaymentIntentionParams
} from './payment-provider.interface.js';
import { env } from '../../config/env.js';

export class PaymobProvider implements IPaymentProvider {
  readonly name = 'PAYMOB';

  private get secretKey(): string {
    return env.PAYMOB_SECRET_KEY;
  }

  private get publicKey(): string {
    return env.PAYMOB_PUBLIC_KEY;
  }

  private get hmacSecret(): string {
    return env.PAYMOB_HMAC_SECRET || 'codek_paymob_hmac_secret_default_key';
  }

  private get integrationIds(): number[] {
    const ids: number[] = [];
    if (env.PAYMOB_INTEGRATION_ID_CARD) ids.push(Number(env.PAYMOB_INTEGRATION_ID_CARD));
    if (env.PAYMOB_INTEGRATION_ID_WALLET) ids.push(Number(env.PAYMOB_INTEGRATION_ID_WALLET));
    return ids.length > 0 ? ids : [12345, 67890];
  }

  private get apiBase(): string {
    return env.PAYMOB_API_BASE;
  }

  /**
   * Create a payment intention via POST /v1/intention/
   * Returns client_secret for frontend checkout.
   */
  async createPaymentIntention(params: CreatePaymentIntentionParams): Promise<PaymentIntention> {
    if (!this.secretKey) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Paymob live credentials missing: PAYMOB_SECRET_KEY is required in production');
      }
      // In development or test without live credentials, generate a sandbox session
      const mockIntentionId = `mock_int_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const mockClientSecret = `mock_secret_${Date.now()}`;
      return {
        intentionId: mockIntentionId,
        clientSecret: mockClientSecret,
        publicKey: this.publicKey || 'mock_public_key',
        redirectUrl: `${this.apiBase}/unifiedcheckout/?publicKey=${this.publicKey || 'mock_pk'}&clientSecret=${mockClientSecret}`
      };
    }

    const amountInPiasters = params.amount * 100;

    const payload = {
      amount: amountInPiasters,
      currency: params.currency || 'EGP',
      payment_methods: this.integrationIds,
      items: [
        {
          name: `CodeK Academy Subscription`,
          amount: amountInPiasters,
          description: `Subscription payment - Order ${params.orderId}`,
          quantity: 1
        }
      ],
      billing_data: {
        first_name: params.studentName.split(' ')[0] || 'Student',
        last_name: params.studentName.split(' ').slice(1).join(' ') || 'CodeK',
        email: params.studentEmail || 'student@codek.local',
        phone_number: 'NA',
        country: 'EG',
        state: 'NA',
        city: 'NA',
        street: 'NA',
        building: 'NA',
        floor: 'NA',
        apartment: 'NA'
      },
      extras: {
        order_id: params.orderId
      },
      special_reference: params.orderId,
      notification_url: params.notificationUrl,
      redirection_url: params.redirectUrl
    };

    const response = await fetch(`${this.apiBase}/v1/intention/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Paymob intention creation failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as {
      id: string;
      client_secret: string;
      intention_order_id?: string;
    };

    return {
      intentionId: data.id || data.intention_order_id || '',
      clientSecret: data.client_secret,
      publicKey: this.publicKey,
      redirectUrl: `${this.apiBase}/unifiedcheckout/?publicKey=${this.publicKey}&clientSecret=${data.client_secret}`
    };
  }

  /**
   * Verify an incoming Paymob webhook callback using HMAC-SHA512.
   *
   * Paymob sends a POST with the transaction data in the request body
   * and an `hmac` parameter in the query string.
   *
   * Verification steps:
   * 1. Extract the `hmac` from query params
   * 2. Sort the relevant callback fields lexicographically by key
   * 3. Concatenate the values
   * 4. Compute HMAC-SHA512 with our HMAC secret
   * 5. Compare with the provided hmac
   */
  verifyWebhook(
    headers: Record<string, string>,
    body: any,
    query: Record<string, string>
  ): WebhookVerificationResult {
    const providedHmac = query.hmac || '';
    const txnData = body?.obj || body;

    // Extract the transaction fields for HMAC verification
    // These are the standard Paymob callback fields sorted lexicographically
    const fieldsToHash: Record<string, any> = {
      amount_cents: txnData?.amount_cents,
      created_at: txnData?.created_at,
      currency: txnData?.currency,
      error_occured: txnData?.error_occured,
      has_parent_transaction: txnData?.has_parent_transaction,
      id: txnData?.id,
      integration_id: txnData?.integration_id,
      is_3d_secure: txnData?.is_3d_secure,
      is_auth: txnData?.is_auth,
      is_capture: txnData?.is_capture,
      is_refunded: txnData?.is_refunded,
      is_standalone_payment: txnData?.is_standalone_payment,
      is_voided: txnData?.is_voided,
      'order.id': txnData?.order?.id,
      owner: txnData?.owner,
      pending: txnData?.pending,
      'source_data.pan': txnData?.source_data?.pan,
      'source_data.sub_type': txnData?.source_data?.sub_type,
      'source_data.type': txnData?.source_data?.type,
      success: txnData?.success
    };

    // Sort keys lexicographically and concatenate values
    const sortedKeys = Object.keys(fieldsToHash).sort();
    const concatenated = sortedKeys.map(k => String(fieldsToHash[k] ?? '')).join('');

    // In production, reject immediately if live HMAC secret is not configured
    if (env.NODE_ENV === 'production' && (!env.PAYMOB_HMAC_SECRET || this.hmacSecret.includes('default_key'))) {
      return {
        verified: false,
        eventId: String(txnData?.id || ''),
        eventType: body?.type || 'TRANSACTION',
        transactionId: String(txnData?.id || ''),
        orderId: '',
        amount: 0,
        amountCents: 0,
        currency: 'EGP',
        success: false,
        rawPayload: body
      };
    }

    // Compute HMAC-SHA512
    const computedHmac = crypto
      .createHmac('sha512', this.hmacSecret)
      .update(concatenated)
      .digest('hex');

    let verified = false;
    if (providedHmac && typeof providedHmac === 'string') {
      try {
        const computedBuffer = Buffer.from(computedHmac, 'hex');
        const providedBuffer = Buffer.from(providedHmac, 'hex');

        if (computedBuffer.length === providedBuffer.length && computedBuffer.length > 0) {
          verified = crypto.timingSafeEqual(computedBuffer, providedBuffer);
        }
      } catch {
        verified = false;
      }
    }

    // Extract orderId from special_reference (our PaymentTransaction.id)
    const orderId =
      txnData?.order?.merchant_order_id ||
      txnData?.merchant_order_id ||
      txnData?.special_reference ||
      txnData?.order?.special_reference ||
      txnData?.order?.extras?.order_id ||
      txnData?.extras?.order_id ||
      txnData?.order?.shipping_data?.extra_description ||
      '';

    const rawAmountCents = txnData?.amount_cents;
    const amountCents = typeof rawAmountCents === 'number' 
      ? Math.round(rawAmountCents)
      : parseInt(String(rawAmountCents || '0'), 10) || 0;

    return {
      verified,
      eventId: String(txnData?.id || ''),
      eventType: body?.type || 'TRANSACTION',
      transactionId: String(txnData?.id || ''),
      orderId,
      amount: Math.floor(amountCents / 100),
      amountCents,
      currency: (txnData?.currency || 'EGP').toUpperCase().trim(),
      success: txnData?.success === true,
      rawPayload: body
    };
  }

  /**
   * Request a refund via the Paymob refund API.
   */
  async refund(providerTransactionId: string, amount: number): Promise<RefundResult> {
    if (!this.secretKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
      return {
        success: true,
        refundId: `mock_ref_${Date.now()}`,
        providerResponse: { mock: true, refunded: true }
      };
    }

    const amountInPiasters = amount * 100;

    const response = await fetch(`${this.apiBase}/api/acceptance/void_refund/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction_id: providerTransactionId,
        amount_cents: amountInPiasters
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        providerResponse: { status: response.status, body: errorBody }
      };
    }

    const data = await response.json() as Record<string, any>;
    return {
      success: data.success === true || data.is_refunded === true,
      refundId: data.id ? String(data.id) : undefined,
      providerResponse: data
    };
  }
}
