CREATE TYPE "OrderFulfillmentStatus" AS ENUM (
  'REVIEWING',
  'ACCEPTED',
  'READY_FOR_DELIVERY',
  'IN_TRANSIT',
  'RECEIVED'
);

ALTER TABLE "Order"
  ADD COLUMN "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'REVIEWING';

CREATE INDEX "Order_fulfillmentStatus_createdAt_idx"
  ON "Order"("fulfillmentStatus", "createdAt");
