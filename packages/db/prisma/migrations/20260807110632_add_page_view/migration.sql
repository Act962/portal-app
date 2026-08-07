-- CreateTable
CREATE TABLE "page_view" (
    "id" TEXT NOT NULL,
    "articleSlug" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readingSeconds" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'outro',

    CONSTRAINT "page_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_view_occurredAt_idx" ON "page_view"("occurredAt");

-- CreateIndex
CREATE INDEX "page_view_articleSlug_occurredAt_idx" ON "page_view"("articleSlug", "occurredAt");
