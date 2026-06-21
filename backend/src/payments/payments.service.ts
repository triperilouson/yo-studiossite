import { createHash } from 'node:crypto';
import {
  ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_PROVIDER, type PaymentProvider, type VerifiedPaymentWebhook,
} from './contracts/payment-provider';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async createSession(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Order is not awaiting payment');
    }
    const existing = await this.prisma.payment.findUnique({
      where: { orderId_provider: { orderId: order.id, provider: this.provider.name } },
      select: { id: true, status: true, checkoutUrl: true, providerSessionId: true },
    });
    if (existing?.status === PaymentStatus.PENDING && existing.checkoutUrl) return existing;
    const session = await this.provider.createSession({
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      customerEmail: order.emailSnapshot,
    });
    const payment = await this.prisma.payment.upsert({
      where: { orderId_provider: { orderId: order.id, provider: this.provider.name } },
      create: {
        provider: this.provider.name, providerSessionId: session.providerSessionId,
        status: PaymentStatus.PENDING, amountMinor: order.totalMinor,
        currency: order.currency, checkoutUrl: session.checkoutUrl, orderId: order.id,
        ...(session.metadata ? { metadata: session.metadata } : {}),
      },
      update: {
        providerSessionId: session.providerSessionId, status: PaymentStatus.PENDING,
        amountMinor: order.totalMinor, currency: order.currency, checkoutUrl: session.checkoutUrl,
        providerRawStatus: null, failedAt: null,
        ...(session.metadata ? { metadata: session.metadata } : {}),
      },
      select: { id: true, status: true, checkoutUrl: true, providerSessionId: true },
    });
    return payment;
  }

  async receiveWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ accepted: true; duplicate: boolean }> {
    if (!rawBody) throw new UnauthorizedException('Webhook signature cannot be verified');
    const verified = await this.provider.verifyWebhook(rawBody, headers);
    if (!verified) throw new UnauthorizedException('Invalid webhook signature');
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.webhookEvent.findUnique({
          where: { provider_providerEventId: { provider: this.provider.name, providerEventId: verified.eventId } },
        });
        if (existing?.processedAt) {
          if (existing.payloadHash !== payloadHash) {
            throw new UnauthorizedException('Webhook event payload mismatch');
          }
          return { accepted: true as const, duplicate: true };
        }
        const event = existing ?? await tx.webhookEvent.create({
          data: {
            provider: this.provider.name,
            providerEventId: verified.eventId,
            payloadHash,
          },
        });
        if (event.payloadHash !== payloadHash) throw new UnauthorizedException('Webhook event payload mismatch');

        const payment = await tx.payment.findFirst({
          where: {
            provider: this.provider.name,
            OR: [
              { providerSessionId: verified.providerSessionId },
              { providerPaymentId: verified.providerPaymentId },
            ],
          },
          include: { order: { include: { items: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');
        if (
          payment.amountMinor !== payment.order.totalMinor ||
          payment.currency !== payment.order.currency ||
          verified.amountMinor !== payment.amountMinor ||
          verified.currency !== payment.currency
        ) {
          throw new ConflictException('Payment amount does not match order');
        }

        await this.applyVerifiedStatus(tx, payment, verified);
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date(), processingError: null },
        });
        return { accepted: true as const, duplicate: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.webhookEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: this.provider.name,
              providerEventId: verified.eventId,
            },
          },
        });
        if (!concurrent) throw error;
        if (concurrent?.payloadHash !== payloadHash) {
          throw new UnauthorizedException('Webhook event payload mismatch');
        }
        if (concurrent.processedAt) return { accepted: true, duplicate: true };
        throw new ConflictException('Webhook processing is still in progress');
      }
      await this.prisma.webhookEvent.upsert({
        where: {
          provider_providerEventId: {
            provider: this.provider.name,
            providerEventId: verified.eventId,
          },
        },
        create: {
          provider: this.provider.name,
          providerEventId: verified.eventId,
          payloadHash,
          processingError: this.processingError(error),
        },
        update: { processingError: this.processingError(error) },
      }).catch(() => undefined);
      throw error;
    }
  }

  private async applyVerifiedStatus(
    tx: Prisma.TransactionClient,
    payment: Prisma.PaymentGetPayload<{ include: { order: { include: { items: true } } } }>,
    webhook: VerifiedPaymentWebhook,
  ): Promise<void> {
    const commonUpdate = {
      providerPaymentId: webhook.providerPaymentId,
      providerSessionId: webhook.providerSessionId,
      providerRawStatus: webhook.rawStatus,
      ...(webhook.metadata ? { metadata: webhook.metadata } : {}),
    };
    const { status } = webhook;
    if (status === 'SUCCEEDED') {
      if (payment.status === PaymentStatus.SUCCEEDED && payment.order.status === OrderStatus.PAID) return;
      if (payment.order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order cannot transition to PAID');
      }
      for (const item of payment.order.items) {
        const updated = await tx.$executeRaw`
          UPDATE "ProductVariant"
          SET "stock" = "stock" - ${item.quantity},
              "reservedStock" = "reservedStock" - ${item.quantity},
              "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}::uuid
            AND "stock" >= ${item.quantity}
            AND "reservedStock" >= ${item.quantity}
        `;
        if (updated !== 1) throw new ConflictException('Reserved inventory is inconsistent');
      }
      await tx.payment.update({
        where: { id: payment.id },
        data: { ...commonUpdate, status: PaymentStatus.SUCCEEDED, paidAt: new Date(), failedAt: null },
      });
      await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.PAID } });
      return;
    }

    if (status === 'FAILED') {
      if (payment.status === PaymentStatus.FAILED) return;
      if (payment.status === PaymentStatus.SUCCEEDED || payment.order.status === OrderStatus.PAID) {
        return;
      }
      if (payment.order.status === OrderStatus.PENDING_PAYMENT) {
        for (const item of payment.order.items) {
          const released = await tx.$executeRaw`
            UPDATE "ProductVariant"
            SET "reservedStock" = "reservedStock" - ${item.quantity}, "updatedAt" = NOW()
            WHERE "id" = ${item.variantId}::uuid
              AND "reservedStock" >= ${item.quantity}
          `;
          if (released !== 1) throw new ConflictException('Reserved inventory is inconsistent');
        }
        await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.FAILED } });
      }
      await tx.payment.update({
        where: { id: payment.id },
        data: { ...commonUpdate, status: PaymentStatus.FAILED, failedAt: new Date() },
      });
      return;
    }

    if (payment.status !== PaymentStatus.SUCCEEDED || payment.order.status !== OrderStatus.PAID) {
      throw new ConflictException('Only a paid order can be refunded');
    }
    await tx.payment.update({
      where: { id: payment.id }, data: { ...commonUpdate, status: PaymentStatus.REFUNDED },
    });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.REFUNDED } });
  }

  private processingError(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown webhook processing error').slice(0, 2000);
  }
}
