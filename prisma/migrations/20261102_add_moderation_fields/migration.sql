-- AlterTable
ALTER TABLE "ClassifiedAd" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "moderationReason" VARCHAR(500);
