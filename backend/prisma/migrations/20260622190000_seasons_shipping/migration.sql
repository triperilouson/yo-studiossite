CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ShippingMethod" AS ENUM ('PICKUP', 'DELIVERY');

CREATE TABLE "Season" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Season_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "SeasonImage" (
  "id" UUID NOT NULL,
  "seasonId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "alt" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeasonImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeasonImage_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "ShippingCountry" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ILS',
  "priceMinor" INTEGER NOT NULL,
  "freeThresholdMinor" INTEGER,
  "minOrderMinor" INTEGER,
  "maxOrderMinor" INTEGER,
  "estimatedMinDays" INTEGER NOT NULL,
  "estimatedMaxDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingCountry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShippingCountry_amounts_check" CHECK (
    "priceMinor" >= 0 AND
    ("freeThresholdMinor" IS NULL OR "freeThresholdMinor" >= 0) AND
    ("minOrderMinor" IS NULL OR "minOrderMinor" >= 0) AND
    ("maxOrderMinor" IS NULL OR "maxOrderMinor" >= 0) AND
    ("minOrderMinor" IS NULL OR "maxOrderMinor" IS NULL OR "minOrderMinor" <= "maxOrderMinor")
  ),
  CONSTRAINT "ShippingCountry_days_check" CHECK (
    "estimatedMinDays" >= 0 AND "estimatedMaxDays" >= "estimatedMinDays"
  ),
  CONSTRAINT "ShippingCountry_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "PickupLocation" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "details" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PickupLocation_sortOrder_check" CHECK ("sortOrder" >= 0)
);

ALTER TABLE "Product" ADD COLUMN "seasonId" UUID;
ALTER TABLE "Order" ADD COLUMN "shippingMethod" "ShippingMethod";
ALTER TABLE "Order" ADD COLUMN "shippingCountryCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupLocationSnapshot" JSONB;

CREATE UNIQUE INDEX "Season_slug_key" ON "Season"("slug");
CREATE UNIQUE INDEX "Season_code_key" ON "Season"("code");
CREATE INDEX "Season_status_sortOrder_idx" ON "Season"("status", "sortOrder");
CREATE UNIQUE INDEX "SeasonImage_seasonId_position_key" ON "SeasonImage"("seasonId", "position");
CREATE INDEX "SeasonImage_seasonId_idx" ON "SeasonImage"("seasonId");
CREATE INDEX "Product_seasonId_status_idx" ON "Product"("seasonId", "status");
CREATE UNIQUE INDEX "ShippingCountry_code_key" ON "ShippingCountry"("code");
CREATE INDEX "ShippingCountry_isActive_sortOrder_idx" ON "ShippingCountry"("isActive", "sortOrder");
CREATE UNIQUE INDEX "PickupLocation_slug_key" ON "PickupLocation"("slug");
CREATE INDEX "PickupLocation_isActive_sortOrder_idx" ON "PickupLocation"("isActive", "sortOrder");

ALTER TABLE "SeasonImage" ADD CONSTRAINT "SeasonImage_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Season" (
  "id", "slug", "code", "title", "description", "status", "sortOrder", "publishedAt", "updatedAt"
) VALUES (
  'a5f45632-f3fd-49b8-88af-31d9b3037b2b', 's2-open-space', 'S2', 'OPEN SPACE',
  'A study of movement, distance and silhouettes shaped by open air.', 'PUBLISHED', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "SeasonImage" ("id", "seasonId", "url", "alt", "position", "updatedAt") VALUES
  ('78f9d2ea-0910-4b76-b3ae-8903d5b28e41', 'a5f45632-f3fd-49b8-88af-31d9b3037b2b', '/assets/s2/shirt1.png', 'YO STUDIOS S2 look 1', 0, CURRENT_TIMESTAMP),
  ('2e29271f-bafb-44ad-b6d0-bf2a20d2de7a', 'a5f45632-f3fd-49b8-88af-31d9b3037b2b', '/assets/s2/shirt2.png', 'YO STUDIOS S2 look 2', 1, CURRENT_TIMESTAMP),
  ('19f45d37-6d76-4685-bff6-ae7932f637e2', 'a5f45632-f3fd-49b8-88af-31d9b3037b2b', '/assets/s2/shirt3.png', 'YO STUDIOS S2 look 3', 2, CURRENT_TIMESTAMP),
  ('c8b6cfba-25cc-40f9-bcf8-519c3dd6e8f4', 'a5f45632-f3fd-49b8-88af-31d9b3037b2b', '/assets/s2/shirt4.PNG', 'YO STUDIOS S2 look 4', 3, CURRENT_TIMESTAMP);

INSERT INTO "ShippingCountry" (
  "id", "code", "name", "currency", "priceMinor", "freeThresholdMinor",
  "estimatedMinDays", "estimatedMaxDays", "sortOrder", "updatedAt"
) VALUES (
  'bb2a2ee1-203f-4c4b-85ce-aa5592ae0a13', 'IL', 'Israel', 'ILS', 3000, 50000, 2, 5, 10, CURRENT_TIMESTAMP
);
