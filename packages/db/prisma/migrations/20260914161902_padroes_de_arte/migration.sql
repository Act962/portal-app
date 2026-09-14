-- CreateTable
CREATE TABLE "social_art_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "layers" JSONB NOT NULL DEFAULT '[]',
    "defaultFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_art_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_art_template_archived_name_idx" ON "social_art_template"("archived", "name");
