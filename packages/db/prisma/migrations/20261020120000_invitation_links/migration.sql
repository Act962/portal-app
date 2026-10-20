ALTER TABLE "invitation" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "invitation" ADD COLUMN "claimedEmail" TEXT;

CREATE INDEX "invitation_claimedEmail_acceptedAt_idx"
ON "invitation"("claimedEmail", "acceptedAt");
