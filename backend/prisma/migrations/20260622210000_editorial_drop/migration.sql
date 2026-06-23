ALTER TABLE "Season"
ADD COLUMN "campaignText" TEXT,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "releaseAt" TIMESTAMP(3),
ADD COLUMN "previewTokenHash" TEXT;

CREATE UNIQUE INDEX "Season_single_featured_idx" ON "Season"("isFeatured") WHERE "isFeatured" = true;
CREATE INDEX "Season_releaseAt_idx" ON "Season"("releaseAt");

UPDATE "Season"
SET "isFeatured" = true,
    "campaignText" = 'Movement, distance and the quiet tension of open space.'
WHERE "code" = 'S2';
