import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  CreatePaymentSessionInput, CreatedPaymentSession, PaymentProvider, VerifiedPaymentWebhook,
} from './contracts/payment-provider';

@Injectable()
export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = 'grow';

  createSession(_input: CreatePaymentSessionInput): Promise<CreatedPaymentSession> {
    void _input;
    throw new ServiceUnavailableException('Grow payment provider is not configured');
  }

  verifyWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): Promise<VerifiedPaymentWebhook | null> {
    void _rawBody;
    void _headers;
    return Promise.resolve(null);
  }
}
