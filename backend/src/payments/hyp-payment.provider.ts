import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';
import type {
  CreatePaymentSessionInput, CreatedPaymentSession, PaymentProvider, VerifiedPaymentWebhook,
} from './contracts/payment-provider';

type HypParams = Record<string, string>;

const APPROVED_CCODE = '0';

@Injectable()
export class HypPaymentProvider implements PaymentProvider {
  readonly name = 'hyp';

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async createSession(input: CreatePaymentSessionInput): Promise<CreatedPaymentSession> {
    const params = this.credentials({
      action: 'APISign',
      What: 'SIGN',
      Order: input.orderId,
      Amount: this.amount(input.amountMinor),
      Info: `Order ${input.orderId}`,
      UserId: input.customerEmail,
      ClientName: input.customerName || input.customerEmail,
      email: input.customerEmail,
      Coin: this.coin(input.currency),
      Tash: '1',
      UTF8: 'True',
      UTF8out: 'True',
      Sign: 'True',
      MoreData: 'True',
      sendemail: 'False',
    });
    const signResult = await this.request(params);
    const checkoutUrl = signResult.startsWith('http') ? signResult : `${this.baseUrl()}?${signResult}`;
    return {
      providerSessionId: input.orderId,
      checkoutUrl,
      metadata: { provider: this.name },
    };
  }

  async verifyWebhook(rawBody: Buffer, _headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentWebhook | null> {
    const params = this.parsePayload(rawBody);
    const orderId = params.Order || params.order || params.OrderId;
    const transactionId = params.Id || params.TransId || params.ACode || params.id;
    if (!orderId || !transactionId) return null;
    const verifyQuery = await this.request(this.credentials({
      action: 'APISign',
      What: 'VERIFY',
      ...params,
    }));
    const verified = this.parseQuery(verifyQuery);
    const ccode = verified.CCode || params.CCode || params.ccode;
    const amount = verified.Amount || params.Amount || params.amount;
    const status = ccode === APPROVED_CCODE ? 'SUCCEEDED' : 'FAILED';
    return {
      eventId: transactionId,
      providerSessionId: orderId,
      providerPaymentId: transactionId,
      rawStatus: ccode || 'UNKNOWN',
      status,
      amountMinor: this.amountMinor(amount),
      currency: this.currency(verified.Coin || params.Coin),
      metadata: this.safeMetadata(params),
    };
  }

  private async request(params: HypParams) {
    const response = await fetch(`${this.baseUrl()}?${new URLSearchParams(params).toString()}`, { method: 'GET' });
    const text = (await response.text()).trim();
    if (!response.ok || !text) throw new UnauthorizedException('Hyp payment request failed');
    return text.startsWith('?') ? text.slice(1) : text;
  }

  private credentials(extra: HypParams): HypParams {
    const key = this.config.get('HYP_API_KEY', { infer: true });
    const passp = this.config.get('HYP_PASSP', { infer: true });
    const masof = this.config.get('HYP_MASOF', { infer: true });
    if (!key || !passp || !masof) throw new ServiceUnavailableException('Hyp payment provider is not configured');
    return { Masof: masof, KEY: key, PassP: passp, ...extra };
  }

  private baseUrl() {
    return this.config.get('HYP_API_URL', { infer: true }) || 'https://pay.hyp.co.il/p/';
  }

  private parsePayload(rawBody: Buffer): HypParams {
    const text = rawBody.toString('utf8').trim();
    if (!text) return {};
    if (text.startsWith('{')) {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')]));
    }
    return this.parseQuery(text);
  }

  private parseQuery(value: string): HypParams {
    const params = new URLSearchParams(value.startsWith('?') ? value.slice(1) : value);
    return Object.fromEntries([...params.entries()]);
  }

  private amount(amountMinor: number) {
    return (amountMinor / 100).toFixed(2);
  }

  private amountMinor(amount: string | undefined) {
    const numeric = Number(amount || 0);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
  }

  private coin(currency: string) {
    const normalized = currency.toUpperCase();
    if (normalized === 'USD') return '2';
    if (normalized === 'EUR') return '3';
    if (normalized === 'GBP') return '4';
    return '1';
  }

  private currency(coin: string | undefined) {
    if (coin === '2') return 'USD';
    if (coin === '3') return 'EUR';
    if (coin === '4') return 'GBP';
    return 'ILS';
  }

  private safeMetadata(params: HypParams) {
    const { KEY: _key, PassP: _passp, signature: _signature, Sign: _sign, ...safe } = params;
    return safe;
  }
}
