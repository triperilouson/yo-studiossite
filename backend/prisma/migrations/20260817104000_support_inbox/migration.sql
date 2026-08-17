CREATE TYPE "SupportThreadStatus" AS ENUM (
  'OPEN',
  'WAITING_CUSTOMER',
  'CLOSED'
);

CREATE TYPE "SupportMessageDirection" AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

CREATE TABLE "SupportThread" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "subject" TEXT NOT NULL,
  "status" "SupportThreadStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
  "id" UUID NOT NULL,
  "threadId" UUID NOT NULL,
  "direction" "SupportMessageDirection" NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "toEmail" TEXT,
  "body" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportThread_status_updatedAt_idx"
  ON "SupportThread"("status", "updatedAt");

CREATE INDEX "SupportThread_email_createdAt_idx"
  ON "SupportThread"("email", "createdAt");

CREATE UNIQUE INDEX "SupportMessage_providerMessageId_key"
  ON "SupportMessage"("providerMessageId");

CREATE INDEX "SupportMessage_threadId_createdAt_idx"
  ON "SupportMessage"("threadId", "createdAt");

ALTER TABLE "SupportMessage"
  ADD CONSTRAINT "SupportMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
