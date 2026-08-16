import { createHash } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus, PaymentStatus, Prisma, ReceiptPaymentMethod, ReceiptSource, ReceiptStatus,
} from '@prisma/client';
import { AdminAuditService } from '../common/admin-audit.service';
import { MailService } from '../mail/mail.service';
import type { Environment } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CancelReceiptDto, CreateReceiptDto, ReceiptQueryDto, SendReceiptDto } from './dto/accounting.dto';
import { buildReceiptPdf, hashReceiptPayload, receiptDocumentPayload } from './receipt-pdf';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  list(input: ReceiptQueryDto) {
    const where = this.receiptWhere(input);
    return this.prisma.receipt.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { documentNumber: 'desc' }],
      skip: input.skip,
      take: input.take,
    });
  }

  async summary(input: ReceiptQueryDto) {
    const where = this.receiptWhere(input);
    const [issued, cancelled, byMethod, bySource] = await Promise.all([
      this.prisma.receipt.aggregate({
        where: { ...where, status: ReceiptStatus.ISSUED },
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      this.prisma.receipt.aggregate({
        where: { ...where, status: ReceiptStatus.CANCELLED },
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      this.prisma.receipt.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      this.prisma.receipt.groupBy({
        by: ['source'],
        where,
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
    ]);
    const totalReceived = issued._sum.amountMinor || 0;
    const cancellations = cancelled._sum.amountMinor || 0;
    return {
      totalReceived,
      cancellations,
      netReceived: totalReceived - cancellations,
      receipts: issued._count._all,
      cancelledReceipts: cancelled._count._all,
      byPaymentMethod: byMethod.map((row) => ({
        paymentMethod: row.paymentMethod,
        amountMinor: row._sum.amountMinor || 0,
        count: row._count._all,
      })),
      bySource: bySource.map((row) => ({
        source: row.source,
        amountMinor: row._sum.amountMinor || 0,
        count: row._count._all,
      })),
    };
  }

  async createManual(actorId: string, input: CreateReceiptDto) {
    const receipt = await this.prisma.$transaction(async (tx) => {
      const issuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();
      const documentNumber = await this.nextDocumentNumber(tx);
      const business = this.businessSnapshot();
      const electronicDocumentLabel = 'Computerized document / Mismach Memuhshav';
      const payload = receiptDocumentPayload({
        documentNumber,
        issuedAt,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim().toLowerCase() || null,
        payerAddress: input.payerAddress?.trim() || null,
        ...business,
        amountMinor: input.amountMinor,
        currency: input.currency.toUpperCase(),
        description: input.description.trim(),
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference?.trim() || null,
        source: ReceiptSource.MANUAL,
        electronicDocumentLabel,
        documentHash: '',
      });
      const documentHash = hashReceiptPayload(payload);
      const receipt = await tx.receipt.create({
        data: {
          documentNumber,
          issuedAt,
          customerName: input.customerName.trim(),
          customerEmail: input.customerEmail?.trim().toLowerCase() || null,
          payerAddress: input.payerAddress?.trim() || null,
          ...business,
          amountMinor: input.amountMinor,
          currency: input.currency.toUpperCase(),
          description: input.description.trim(),
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference?.trim() || null,
          source: ReceiptSource.MANUAL,
          electronicDocumentLabel,
          electronicDocsConsentAt: input.electronicDocsConsentAt ? new Date(input.electronicDocsConsentAt) : null,
          electronicDocsConsentSource: input.electronicDocsConsentSource?.trim() || null,
          documentHash,
          createdById: actorId,
          events: { create: { actorId, actorType: 'ADMIN', action: 'RECEIPT_CREATED' } },
        },
      });
      return receipt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record(actorId, 'RECEIPT_CREATED', 'Receipt', receipt.id, {
      documentNumber: receipt.documentNumber,
      source: receipt.source,
    });
    return receipt;
  }

  async createForPayment(tx: Tx, paymentId: string) {
    const existing = await tx.receipt.findUnique({ where: { paymentId } });
    if (existing) return existing;
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.SUCCEEDED || payment.order.status !== OrderStatus.PAID) {
      throw new ConflictException('Receipt can only be issued after confirmed payment');
    }
    const issuedAt = payment.paidAt || new Date();
    const documentNumber = await this.nextDocumentNumber(tx);
    const business = this.businessSnapshot();
    const description = `Website order ${payment.order.id}`;
    const electronicDocumentLabel = 'Computerized document / Mismach Memuhshav';
    const payload = receiptDocumentPayload({
      documentNumber,
      issuedAt,
      customerName: payment.order.nameSnapshot,
      customerEmail: payment.order.emailSnapshot,
      payerAddress: this.addressSnapshotText(payment.order.addressSnapshot),
      ...business,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      description,
      paymentMethod: ReceiptPaymentMethod.WEBSITE,
      paymentReference: payment.providerPaymentId || payment.providerSessionId || null,
      source: ReceiptSource.WEBSITE,
      electronicDocumentLabel,
      documentHash: '',
    });
    return tx.receipt.create({
      data: {
        documentNumber,
        issuedAt,
        customerName: payment.order.nameSnapshot,
        customerEmail: payment.order.emailSnapshot,
        payerAddress: this.addressSnapshotText(payment.order.addressSnapshot),
        ...business,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        description,
        paymentMethod: ReceiptPaymentMethod.WEBSITE,
        paymentReference: payment.providerPaymentId || payment.providerSessionId || null,
        source: ReceiptSource.WEBSITE,
        electronicDocumentLabel,
        electronicDocsConsentAt: payment.order.createdAt,
        electronicDocsConsentSource: 'WEBSITE_CHECKOUT',
        orderId: payment.orderId,
        paymentId: payment.id,
        documentHash: hashReceiptPayload(payload),
        events: { create: { actorType: 'SYSTEM', action: 'RECEIPT_CREATED', metadata: { paymentId: payment.id } } },
      },
    });
  }

  async pdf(id: string, actorId?: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    const buffer = buildReceiptPdf(receipt);
    const pdfHash = createHash('sha256').update(buffer).digest('hex');
    if (receipt.pdfHash !== pdfHash) {
      await this.prisma.receipt.update({ where: { id }, data: { pdfHash } });
      await this.prisma.receiptEvent.create({
        data: { receiptId: id, actorId, actorType: actorId ? 'ADMIN' : 'SYSTEM', action: 'PDF_GENERATED', metadata: { pdfHash } },
      });
    }
    return { receipt: { ...receipt, pdfHash }, buffer };
  }

  async send(actorId: string, id: string, input: SendReceiptDto) {
    const { receipt, buffer } = await this.pdf(id, actorId);
    const to = input.email?.trim().toLowerCase() || receipt.customerEmail;
    if (!to) throw new ConflictException('Receipt has no email address');
    try {
      await this.mail.sendReceiptPdf(to, receipt, buffer);
      await this.prisma.receiptEvent.create({
        data: { receiptId: id, actorId, actorType: 'ADMIN', action: 'EMAIL_SENT', metadata: { to } },
      });
    } catch (error) {
      await this.prisma.receiptEvent.create({
        data: {
          receiptId: id, actorId, actorType: 'ADMIN', action: 'EMAIL_FAILED',
          metadata: { to, error: error instanceof Error ? error.message : 'Unknown mail error' },
        },
      });
      throw error;
    }
    return { sent: true };
  }

  async cancel(actorId: string, id: string, input: CancelReceiptDto) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.status === ReceiptStatus.CANCELLED) return receipt;
    const updated = await this.prisma.receipt.update({
      where: { id },
      data: {
        status: ReceiptStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: input.reason.trim(),
        events: { create: { actorId, actorType: 'ADMIN', action: 'RECEIPT_CANCELLED', metadata: { reason: input.reason.trim() } } },
      },
    });
    await this.audit.record(actorId, 'RECEIPT_CANCELLED', 'Receipt', id, { documentNumber: receipt.documentNumber });
    return updated;
  }

  events(id: string) {
    return this.prisma.receiptEvent.findMany({ where: { receiptId: id }, orderBy: { createdAt: 'asc' } });
  }

  private async nextDocumentNumber(tx: Tx) {
    await tx.$executeRaw`
      INSERT INTO "ReceiptSequence" ("key", "nextNumber", "updatedAt")
      VALUES ('receipt', 1, NOW())
      ON CONFLICT ("key") DO NOTHING
    `;
    const rows = await tx.$queryRaw<Array<{ documentNumber: number }>>`
      UPDATE "ReceiptSequence"
      SET "nextNumber" = "nextNumber" + 1, "updatedAt" = NOW()
      WHERE "key" = 'receipt'
      RETURNING "nextNumber" - 1 AS "documentNumber"
    `;
    const number = rows[0]?.documentNumber;
    if (!number) throw new ConflictException('Could not allocate receipt number');
    return number;
  }

  private receiptWhere(input: ReceiptQueryDto): Prisma.ReceiptWhereInput {
    const issuedAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
    const q = input.q?.trim();
    const search: Prisma.ReceiptWhereInput[] = q ? [
      ...(String(Number(q)) === q ? [{ documentNumber: Number(q) }] : []),
      { customerEmail: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { orderId: { equals: this.uuidOrNever(q) } },
      { paymentReference: { contains: q, mode: 'insensitive' } },
    ] : [];
    return {
      ...(Object.keys(issuedAt).length ? { issuedAt } : {}),
      ...(search.length ? { OR: search } : {}),
    };
  }

  private uuidOrNever(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value
      : '00000000-0000-0000-0000-000000000000';
  }

  private businessSnapshot() {
    return {
      businessName: this.config.get('BUSINESS_NAME', { infer: true }),
      businessTaxId: this.config.get('BUSINESS_TAX_ID', { infer: true }) || 'MISSING_BUSINESS_TAX_ID',
      businessAddress: this.config.get('BUSINESS_ADDRESS', { infer: true }) || 'MISSING_BUSINESS_ADDRESS',
    };
  }

  private addressSnapshotText(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    return [record.line1, record.line2, record.city, record.postalCode, record.country]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(', ') || null;
  }
}
