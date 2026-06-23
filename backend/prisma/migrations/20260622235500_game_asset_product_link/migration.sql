ALTER TABLE "GameAsset"
ADD COLUMN "productId" UUID;

CREATE INDEX "GameAsset_productId_idx" ON "GameAsset"("productId");

ALTER TABLE "GameAsset"
ADD CONSTRAINT "GameAsset_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
