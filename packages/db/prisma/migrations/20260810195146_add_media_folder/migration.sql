-- AlterTable
ALTER TABLE "media_asset" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "media_folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_folder_name_key" ON "media_folder"("name");

-- CreateIndex
CREATE INDEX "media_asset_folderId_idx" ON "media_asset"("folderId");

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
