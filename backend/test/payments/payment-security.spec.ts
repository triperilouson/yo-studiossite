import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from '../../src/payments/payments.service';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

describe('payment webhook security', () => {
  it('fails closed and never starts a database transaction for an invalid signature', async () => {
    const prisma = { $transaction: vi.fn() };
    const provider = {
      name: 'grow', createSession: vi.fn(), verifyWebhook: vi.fn().mockResolvedValue(null),
    };
    const service = new PaymentsService(prisma as never, provider);

    await expect(service.receiveWebhook(Buffer.from('{}'), {})).rejects.toThrow('Invalid webhook signature');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('acknowledges a previously processed valid event without updating payment or order again', async () => {
    const tx = {
      webhookEvent: {
        findUnique: vi.fn().mockResolvedValue({
          processedAt: new Date(),
          payloadHash: createHash('sha256').update('{}').digest('hex'),
        }),
      },
      payment: { findFirst: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const provider = {
      name: 'grow',
      createSession: vi.fn(),
      verifyWebhook: vi.fn().mockResolvedValue({
        eventId: 'event-1', providerSessionId: 'session-1', providerPaymentId: 'payment-1',
        rawStatus: 'paid', status: 'SUCCEEDED' as const,
        amountMinor: 1000, currency: 'ILS',
      }),
    };
    const service = new PaymentsService(prisma as never, provider);

    await expect(service.receiveWebhook(Buffer.from('{}'), {}))
      .resolves.toEqual({ accepted: true, duplicate: true });
    expect(tx.payment.findFirst).not.toHaveBeenCalled();
  });

  it('does not acknowledge a concurrent event until the first transaction has processed it', async () => {
    const payloadHash = createHash('sha256').update('{}').digest('hex');
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002', clientVersion: '6.19.3',
      })),
      webhookEvent: {
        findUnique: vi.fn().mockResolvedValue({ payloadHash, processedAt: null }),
      },
    };
    const provider = {
      name: 'grow',
      createSession: vi.fn(),
      verifyWebhook: vi.fn().mockResolvedValue({
        eventId: 'event-2', providerSessionId: 'session-2', providerPaymentId: 'payment-2',
        rawStatus: 'paid', status: 'SUCCEEDED' as const, amountMinor: 1000, currency: 'ILS',
      }),
    };
    const service = new PaymentsService(prisma as never, provider);

    await expect(service.receiveWebhook(Buffer.from('{}'), {}))
      .rejects.toThrow('Webhook processing is still in progress');
  });
});
