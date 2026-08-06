-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "logoMediaId" TEXT,
    "radioFrequency" TEXT,
    "radioBand" TEXT,
    "radioStreamUrl" TEXT,
    "contactNewsroom" TEXT,
    "contactWhatsapp" TEXT,
    "contactEmail" TEXT,
    "contactAddress" TEXT,
    "social" JSONB NOT NULL,
    "institutional" JSONB NOT NULL,
    "popularSearches" JSONB NOT NULL,
    "legal" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
