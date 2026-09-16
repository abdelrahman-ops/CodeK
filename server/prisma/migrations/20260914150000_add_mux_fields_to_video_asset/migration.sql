-- AlterTable VideoAsset
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "uploadId" TEXT,
ADD COLUMN IF NOT EXISTS "playbackId" TEXT,
ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VideoAsset_uploadId_key" ON "VideoAsset"("uploadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoAsset_uploadId_idx" ON "VideoAsset"("uploadId");
