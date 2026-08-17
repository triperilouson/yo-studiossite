import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportMessageDirection, SupportThreadStatus } from '@prisma/client';
import type { Environment } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupportThreadDto, InboundSupportEmailDto, SupportReplyDto } from './dto/support.dto';

const threadSelect = {
  id: true,
  email: true,
  name: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
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

  createThread(input: CreateSupportThreadDto) {
    const email = input.email.trim().toLowerCase();
    return this.prisma.supportThread.create({
      data: {
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
    const parent = await this.findParentMessage(inReplyTo, references);
    const thread = parent
      ? await this.prisma.supportThread.update({
        where: { id: parent.threadId },
        data: {
          status: SupportThreadStatus.OPEN,
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

  listForAdmin() {
    return this.prisma.supportThread.findMany({
      select: threadSelect,
      orderBy: { updatedAt: 'desc' },
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
