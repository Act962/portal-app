-- CreateTable
CREATE TABLE "social_post" (
    "id" TEXT NOT NULL,
    "articleId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "autoKey" TEXT,
    "caption" TEXT NOT NULL,
    "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "approvedAt" TIMESTAMP(3),
    "approvedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_delivery" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "remoteId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),

    CONSTRAINT "social_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_account" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CONECTADA',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedByStaffId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_post_autoKey_key" ON "social_post"("autoKey");

-- CreateIndex
CREATE INDEX "social_post_status_createdAt_idx" ON "social_post"("status", "createdAt");

-- CreateIndex
CREATE INDEX "social_post_articleId_idx" ON "social_post"("articleId");

-- CreateIndex
CREATE INDEX "social_delivery_status_idx" ON "social_delivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "social_delivery_postId_platform_key" ON "social_delivery"("postId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "social_account_platform_key" ON "social_account"("platform");

-- AddForeignKey
ALTER TABLE "social_delivery" ADD CONSTRAINT "social_delivery_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
