/**
 * Payment provider factory.
 * Returns the active provider based on PAYMENT_PROVIDER env var.
 * Defaults to Paymob.
 */

import { IPaymentProvider } from './payment-provider.interface.js';
import { PaymobProvider } from './paymob.provider.js';
import { env } from '../../config/env.js';

let providerInstance: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (providerInstance) return providerInstance;

  const providerName = env.PAYMENT_PROVIDER.toUpperCase();

  switch (providerName) {
    case 'PAYMOB':
      providerInstance = new PaymobProvider();
      break;
    // Future providers:
    // case 'FAWRY':
    //   providerInstance = new FawryProvider();
    //   break;
    // case 'KASHIER':
    //   providerInstance = new KashierProvider();
    //   break;
    default:
      providerInstance = new PaymobProvider();
  }

  return providerInstance;
}

/** Reset cached provider instance (useful for testing) */
export function resetPaymentProvider(): void {
  providerInstance = null;
}

// Re-export the interface for convenience
export type { IPaymentProvider } from './payment-provider.interface.js';
export type {
  PaymentIntention,
  WebhookVerificationResult,
  RefundResult,
  CreatePaymentIntentionParams
} from './payment-provider.interface.js';
