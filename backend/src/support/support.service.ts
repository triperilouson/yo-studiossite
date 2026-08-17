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
    if (input.providerMessageId) {
      const existing = await this.prisma.supportMessage.findUnique({
        where: { providerMessageId: input.providerMessageId },
        select: { threadId: true },
      });
      if (existing) return { accepted: true as const, duplicate: true, threadId: existing.threadId };
    }
    const email = input.fromEmail.trim().toLowerCase();
    const thread = await this.prisma.supportThread.create({
      data: {
        email,
        name: input.fromName?.trim() || undefined,
        subject: input.subject.trim(),
        messages: {
          create: {
            direction: SupportMessageDirection.INBOUND,
            fromEmail: email,
            body: input.body.trim(),
            providerMessageId: input.providerMessageId || undefined,
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
    await this.mail.sendSupportReply(thread.email, thread.subject, body);
    return this.prisma.supportThread.update({
      where: { id: threadId },
      data: {
        status: SupportThreadStatus.WAITING_CUSTOMER,
        messages: {
          create: {
            direction: SupportMessageDirection.OUTBOUND,
            fromEmail: this.config.get('SES_FROM_EMAIL', { infer: true }) || 'support@yo-studios.com',
            toEmail: thread.email,
            body,
          },
        },
      },
      select: threadSelect,
    });
  }
}
