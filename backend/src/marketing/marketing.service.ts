import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MarketingCampaignAudience, MarketingCampaignStatus, MarketingRecipientStatus, MarketingSubscriptionStatus, Prisma,
} from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMarketingCampaignDto, SubscribeDto } from './dto/marketing.dto';

const campaignSelect = {
  id: true,
  status: true,
  audience: true,
  subject: true,
  title: true,
  body: true,
  ctaLabel: true,
  ctaUrl: true,
  imageUrls: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { recipients: true } },
  recipients: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    select: { email: true, status: true, error: true, sentAt: true, createdAt: true },
  },
} as const;

@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async subscribe(input: SubscribeDto) {
    if (!input.consentAccepted) throw new BadRequestException('Marketing consent is required');
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return this.prisma.marketingSubscription.upsert({
      where: { email },
      create: {
        email,
        userId: user?.id,
        status: MarketingSubscriptionStatus.SUBSCRIBED,
        drops: input.drops ?? true,
        insiders: input.insiders ?? false,
        consentText: 'Customer opted in to YO STUDIOS marketing email updates.',
      },
      update: {
        userId: user?.id,
        status: MarketingSubscriptionStatus.SUBSCRIBED,
        drops: input.drops ?? true,
        insiders: input.insiders ?? false,
        consentAt: new Date(),
        unsubscribedAt: null,
      },
      select: { email: true, status: true, drops: true, insiders: true },
    });
  }

  listCampaigns() {
    return this.prisma.marketingCampaign.findMany({
      select: campaignSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  createCampaign(actorId: string, input: CreateMarketingCampaignDto) {
    return this.prisma.marketingCampaign.create({
      data: {
        createdById: actorId,
        audience: input.audience,
        subject: input.subject.trim(),
        title: input.title.trim(),
        body: input.body.trim(),
        ctaLabel: input.ctaLabel?.trim() || undefined,
        ctaUrl: input.ctaUrl?.trim() || undefined,
        imageUrls: input.imageUrls?.map((url) => url.trim()).filter(Boolean) as Prisma.InputJsonValue,
      },
      select: campaignSelect,
    });
  }

  async sendCampaign(campaignId: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      select: { ...campaignSelect, createdById: true },
    });
    if (!campaign) throw new NotFoundException('Marketing campaign not found');
    if (campaign.status === MarketingCampaignStatus.SENDING) throw new ConflictException('Campaign is already sending');
    if (campaign.status === MarketingCampaignStatus.SENT) throw new ConflictException('Campaign was already sent');

    const subscriptions = await this.prisma.marketingSubscription.findMany({
      where: this.subscriptionWhere(campaign.audience),
      select: { email: true, userId: true },
      take: 2000,
    });
    if (!subscriptions.length) throw new ConflictException('No subscribed recipients match this audience');

    await this.prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: MarketingCampaignStatus.SENDING },
    });
    await this.prisma.marketingCampaignRecipient.createMany({
      data: subscriptions.map((item) => ({
        campaignId: campaign.id,
        email: item.email,
        userId: item.userId,
        status: MarketingRecipientStatus.PENDING,
      })),
      skipDuplicates: true,
    });

    let failed = 0;
    for (const recipient of subscriptions) {
      try {
        await this.mail.sendMarketingCampaign(recipient.email, {
          subject: campaign.subject,
          title: campaign.title,
          body: campaign.body,
          ctaLabel: campaign.ctaLabel,
          ctaUrl: campaign.ctaUrl,
          imageUrls: Array.isArray(campaign.imageUrls) ? campaign.imageUrls.filter((url): url is string => typeof url === 'string') : [],
        });
        await this.prisma.marketingCampaignRecipient.update({
          where: { campaignId_email: { campaignId: campaign.id, email: recipient.email } },
          data: { status: MarketingRecipientStatus.SENT, sentAt: new Date(), error: null },
        });
      } catch (error: unknown) {
        failed += 1;
        await this.prisma.marketingCampaignRecipient.update({
          where: { campaignId_email: { campaignId: campaign.id, email: recipient.email } },
          data: {
            status: MarketingRecipientStatus.FAILED,
            error: (error instanceof Error ? error.message : 'Unknown mail error').slice(0, 1000),
          },
        });
      }
    }

    return this.prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: {
        status: failed ? MarketingCampaignStatus.FAILED : MarketingCampaignStatus.SENT,
        sentAt: new Date(),
      },
      select: campaignSelect,
    });
  }

  private subscriptionWhere(audience: MarketingCampaignAudience): Prisma.MarketingSubscriptionWhereInput {
    const base = { status: MarketingSubscriptionStatus.SUBSCRIBED };
    if (audience === MarketingCampaignAudience.DROPS) return { ...base, drops: true };
    if (audience === MarketingCampaignAudience.INSIDERS) return { ...base, insiders: true };
    return { ...base, OR: [{ drops: true }, { insiders: true }] };
  }
}
