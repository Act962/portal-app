ALTER TABLE "media_asset" ADD COLUMN "uploadedByStaffId" TEXT;

CREATE INDEX "media_asset_uploadedByStaffId_createdAt_idx"
ON "media_asset"("uploadedByStaffId", "createdAt");
