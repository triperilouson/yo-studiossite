CREATE TABLE "GameAsset" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "imageData" BYTEA NOT NULL,
    "config" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GameAsset_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "width" <= 4096 AND "height" <= 4096),
    CONSTRAINT "GameAsset_byte_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 750000)
);

CREATE TABLE "GameLevel" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameLevel_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GameLevel_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "width" <= 8192 AND "height" <= 8192)
);

CREATE UNIQUE INDEX "GameAsset_slug_key" ON "GameAsset"("slug");
CREATE INDEX "GameAsset_category_updatedAt_idx" ON "GameAsset"("category", "updatedAt");
CREATE INDEX "GameAsset_createdById_updatedAt_idx" ON "GameAsset"("createdById", "updatedAt");
CREATE UNIQUE INDEX "GameLevel_slug_key" ON "GameLevel"("slug");
CREATE INDEX "GameLevel_isActive_updatedAt_idx" ON "GameLevel"("isActive", "updatedAt");
CREATE INDEX "GameLevel_updatedById_updatedAt_idx" ON "GameLevel"("updatedById", "updatedAt");
