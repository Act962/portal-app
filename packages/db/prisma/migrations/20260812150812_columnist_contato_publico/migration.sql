-- AlterTable
ALTER TABLE "columnist" ADD COLUMN     "email" TEXT,
ADD COLUMN     "socials" JSONB NOT NULL DEFAULT '{}';
