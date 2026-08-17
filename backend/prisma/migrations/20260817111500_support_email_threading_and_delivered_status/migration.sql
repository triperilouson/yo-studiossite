ALTER TYPE "OrderFulfillmentStatus" ADD VALUE 'DELIVERED';

ALTER TABLE "SupportMessage"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "messageId" TEXT,
  ADD COLUMN "inReplyTo" TEXT,
  ADD COLUMN "references" TEXT;

CREATE UNIQUE INDEX "SupportMessage_messageId_key"
  ON "SupportMessage"("messageId");

CREATE INDEX "SupportMessage_inReplyTo_idx"
  ON "SupportMessage"("inReplyTo");
