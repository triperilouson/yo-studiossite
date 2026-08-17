ALTER TYPE "SupportThreadStatus" ADD VALUE 'ARCHIVED';

CREATE TYPE "MarketingSubscriptionStatus" AS ENUM (
  'SUBSCRIBED',
  'UNSUBSCRIBED'
);

CREATE TYPE "MarketingCampaignStatus" AS ENUM (
  'DRAFT',
  'SENDING',
  'SENT',
  'FAILED'
);

CREATE TYPE "MarketingCampaignAudience" AS ENUM (
  'DROPS',
  'INSIDERS',
  'ALL_MARKETING'
);

CREATE TYPE "MarketingRecipientStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED'
);

ALTER TABLE "SupportThread"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "SupportThread" st
SET "userId" = u."id"
FROM "User" u
WHERE lower(st."email") = lower(u."email");

CREATE INDEX "SupportThread_userId_updatedAt_idx"
  ON "SupportThread"("userId", "updatedAt");

CREATE INDEX "SupportThread_archivedAt_idx"
  ON "SupportThread"("archivedAt");

ALTER TABLE "SupportThread"
  ADD CONSTRAINT "SupportThread_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MarketingSubscription" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "userId" UUID,
  "status" "MarketingSubscriptionStatus" NOT NULL DEFAULT 'SUBSCRIBED',
  "drops" BOOLEAN NOT NULL DEFAULT true,
  "insiders" BOOLEAN NOT NULL DEFAULT false,
  "consentText" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingCampaign" (
  "id" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "audience" "MarketingCampaignAudience" NOT NULL,
  "subject" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "imageUrls" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingCampaignRecipient" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "userId" UUID,
  "email" TEXT NOT NULL,
  "status" "MarketingRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSubscription_email_key"
  ON "MarketingSubscription"("email");

CREATE UNIQUE INDEX "MarketingSubscription_userId_key"
  ON "MarketingSubscription"("userId");

CREATE INDEX "MarketingSubscription_status_drops_idx"
  ON "MarketingSubscription"("status", "drops");

CREATE INDEX "MarketingSubscription_status_insiders_idx"
  ON "MarketingSubscription"("status", "insiders");

CREATE INDEX "MarketingCampaign_status_createdAt_idx"
  ON "MarketingCampaign"("status", "createdAt");

CREATE INDEX "MarketingCampaign_audience_createdAt_idx"
  ON "MarketingCampaign"("audience", "createdAt");

CREATE UNIQUE INDEX "MarketingCampaignRecipient_campaignId_email_key"
  ON "MarketingCampaignRecipient"("campaignId", "email");

CREATE INDEX "MarketingCampaignRecipient_campaignId_status_idx"
  ON "MarketingCampaignRecipient"("campaignId", "status");

CREATE INDEX "MarketingCampaignRecipient_email_idx"
  ON "MarketingCampaignRecipient"("email");

CREATE INDEX "MarketingCampaignRecipient_userId_idx"
  ON "MarketingCampaignRecipient"("userId");

ALTER TABLE "MarketingSubscription"
  ADD CONSTRAINT "MarketingSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign"
  ADD CONSTRAINT "MarketingCampaign_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignRecipient"
  ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignRecipient"
  ADD CONSTRAINT "MarketingCampaignRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
