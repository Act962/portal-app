-- CreateTable
CREATE TABLE "ad_campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "advertiser" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "coverMediaId" TEXT,
    "coverAltText" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "weight" INTEGER NOT NULL DEFAULT 1,
    "sectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_daily_stat" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ad_daily_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adsense_settings" (
    "id" TEXT NOT NULL DEFAULT 'adsense',
    "publisherId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "slotIds" JSONB NOT NULL DEFAULT '{}',
    "nonPersonalized" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adsense_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_campaign_slot_status_startsAt_endsAt_idx" ON "ad_campaign"("slot", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ad_campaign_coverMediaId_idx" ON "ad_campaign"("coverMediaId");

-- CreateIndex
CREATE INDEX "ad_daily_stat_day_idx" ON "ad_daily_stat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ad_daily_stat_campaignId_day_key" ON "ad_daily_stat"("campaignId", "day");

-- AddForeignKey
ALTER TABLE "ad_daily_stat" ADD CONSTRAINT "ad_daily_stat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
