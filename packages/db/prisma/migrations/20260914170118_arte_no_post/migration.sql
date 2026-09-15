-- AlterTable
ALTER TABLE "social_post" ADD COLUMN     "art" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "artContent" JSONB NOT NULL DEFAULT '{}';
