export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreatePaymentSessionInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
}

export interface CreatedPaymentSession {
  providerSessionId: string;
  checkoutUrl: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type VerifiedPaymentStatus = 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface VerifiedPaymentWebhook {
  eventId: string;
  providerSessionId: string;
  providerPaymentId: string;
  rawStatus: string;
  status: VerifiedPaymentStatus;
  amountMinor: number;
  currency: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PaymentProvider {
  readonly name: string;
  createSession(input: CreatePaymentSessionInput): Promise<CreatedPaymentSession>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentWebhook | null>;
}
