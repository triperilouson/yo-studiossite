import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SupportMessageDirection, SupportThreadStatus } from '@prisma/client';
import type { Environment } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupportThreadDto, InboundSupportEmailDto, SupportReplyDto, SupportThreadQueryDto } from './dto/support.dto';

const threadSelect = {
  id: true,
  email: true,
  name: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      orders: {
        orderBy: { createdAt: 'desc' as const },
        take: 10,
        select: {
          id: true,
          status: true,
          fulfillmentStatus: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
          items: { select: { titleSnapshot: true, sizeSnapshot: true, quantity: true } },
        },
      },
    },
  },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      direction: true,
      fromEmail: true,
      toEmail: true,
      body: true,
      providerMessageId: true,
      messageId: true,
      inReplyTo: true,
      references: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async createThread(input: CreateSupportThreadDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);
    return this.prisma.supportThread.create({
      data: {
        userId: user?.id,
        email,
        name: input.name?.trim() || undefined,
        subject: input.subject.trim(),
        messages: {
          create: {
            direction: SupportMessageDirection.INBOUND,
            fromEmail: email,
            body: input.message.trim(),
          },
        },
      },
      select: { id: true, status: true },
    });
  }

  async receiveInbound(secret: string | undefined, input: InboundSupportEmailDto) {
    const expected = this.config.get('SUPPORT_INBOUND_WEBHOOK_SECRET', { infer: true });
    if (!expected || secret !== expected) throw new ForbiddenException('Invalid support webhook secret');
    const providerMessageId = input.providerMessageId?.trim() || undefined;
    const messageId = this.cleanMessageId(input.messageId);
    const inReplyTo = this.cleanMessageId(input.inReplyTo);
    const references = input.references?.trim() || undefined;
    const provider = input.provider?.trim().toLowerCase() || undefined;
    if (providerMessageId || messageId) {
      const existing = await this.prisma.supportMessage.findFirst({
        where: { OR: [{ providerMessageId }, { messageId }].filter((item) => Object.values(item).some(Boolean)) },
        select: { threadId: true },
      });
      if (existing) return { accepted: true as const, duplicate: true, threadId: existing.threadId };
    }
    const email = input.fromEmail.trim().toLowerCase();
    const user = await this.findUserByEmail(email);
    const parent = await this.findParentMessage(inReplyTo, references);
    const thread = parent
      ? await this.prisma.supportThread.update({
        where: { id: parent.threadId },
        data: {
          status: SupportThreadStatus.OPEN,
          archivedAt: null,
          messages: {
            create: {
              direction: SupportMessageDirection.INBOUND,
              fromEmail: email,
              body: input.body.trim(),
              provider,
              providerMessageId,
              messageId,
              inReplyTo,
              references,
            },
          },
        },
        select: { id: true },
      })
      : await this.prisma.supportThread.create({
        data: {
          userId: user?.id,
          email,
          name: input.fromName?.trim() || undefined,
          subject: input.subject.trim(),
          messages: {
            create: {
              direction: SupportMessageDirection.INBOUND,
              fromEmail: email,
              body: input.body.trim(),
              provider,
              providerMessageId,
              messageId,
              inReplyTo,
              references,
            },
          },
        },
        select: { id: true },
      });
    return { accepted: true as const, duplicate: false, threadId: thread.id };
  }

  async listForAdmin(query: SupportThreadQueryDto = {}) {
    await this.archiveExpiredClosedThreads();
    const q = query.q?.trim();
    const where: Prisma.SupportThreadWhereInput = {
      ...(query.includeArchived ? {} : { archivedAt: null, status: { not: SupportThreadStatus.ARCHIVED } }),
      ...(query.status ? { status: query.status } : {}),
      ...(q ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
          { messages: { some: { body: { contains: q, mode: 'insensitive' } } } },
        ],
      } : {}),
    };
    const orderBy =
      query.sort === 'oldest' ? { createdAt: 'asc' as const } :
        query.sort === 'newest' ? { createdAt: 'desc' as const } :
          { updatedAt: 'desc' as const };
    return this.prisma.supportThread.findMany({
      where,
      select: threadSelect,
      orderBy,
      take: 100,
    });
  }

  async reply(threadId: string, input: SupportReplyDto) {
    const thread = await this.prisma.supportThread.findUnique({ where: { id: threadId }, select: threadSelect });
    if (!thread) throw new NotFoundException('Support thread not found');
    const body = input.message.trim();
    const messageId = this.outboundMessageId(thread.id);
    await this.mail.sendSupportReply(thread.email, thread.subject, body, messageId);
    return this.prisma.supportThread.update({
      where: { id: threadId },
      data: {
        status: SupportThreadStatus.WAITING_CUSTOMER,
        archivedAt: null,
        messages: {
          create: {
            direction: SupportMessageDirection.OUTBOUND,
            fromEmail: this.config.get('SES_FROM_SUPPORT', { infer: true }) ||
              this.config.get('SES_FROM_EMAIL', { infer: true }) ||
              'support@yo-studios.com',
            toEmail: thread.email,
            body,
            messageId,
          },
        },
      },
      select: threadSelect,
    });
  }

  async close(threadId: string) {
    await this.ensureThread(threadId);
    return this.prisma.supportThread.update({
      where: { id: threadId },
      data: { status: SupportThreadStatus.CLOSED },
      select: threadSelect,
    });
  }

  async archive(threadId: string) {
    await this.ensureThread(threadId);
    return this.prisma.supportThread.update({
      where: { id: threadId },
      data: { status: SupportThreadStatus.ARCHIVED, archivedAt: new Date() },
      select: threadSelect,
    });
  }

  private async ensureThread(threadId: string): Promise<void> {
    const thread = await this.prisma.supportThread.findUnique({ where: { id: threadId }, select: { id: true } });
    if (!thread) throw new NotFoundException('Support thread not found');
  }

  private async archiveExpiredClosedThreads(): Promise<void> {
    const threshold = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await this.prisma.supportThread.updateMany({
      where: { status: SupportThreadStatus.CLOSED, archivedAt: null, updatedAt: { lte: threshold } },
      data: { status: SupportThreadStatus.ARCHIVED, archivedAt: new Date() },
    });
  }

  private findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  private async findParentMessage(inReplyTo: string | undefined, references: string | undefined) {
    const ids = [
      inReplyTo,
      ...this.extractMessageIds(references),
    ].filter((value): value is string => Boolean(value));
    if (!ids.length) return null;
    return this.prisma.supportMessage.findFirst({
      where: { OR: [{ messageId: { in: ids } }, { providerMessageId: { in: ids } }] },
      select: { threadId: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private extractMessageIds(value: string | undefined): string[] {
    if (!value) return [];
    const matches = value.match(/<[^>]+>/g) ?? [];
    return matches.map((item) => this.cleanMessageId(item)).filter((item): item is string => Boolean(item));
  }

  private cleanMessageId(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed : `<${trimmed}>`;
  }

  private outboundMessageId(threadId: string): string {
    return `<support-${threadId}-${Date.now().toString(36)}@yo-studios.com>`;
  }
}
