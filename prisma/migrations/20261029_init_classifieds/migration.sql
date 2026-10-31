-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED', 'PAUSED', 'CLOSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(24),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassifiedAd" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "description" TEXT NOT NULL,
    "priceRub" INTEGER,
    "location" VARCHAR(120) NOT NULL,
    "contactPhone" VARCHAR(24) NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ClassifiedAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPhoto" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ClassifiedAd_slug_key" ON "ClassifiedAd"("slug");

-- CreateIndex
CREATE INDEX "ClassifiedAd_ownerId_createdAt_idx" ON "ClassifiedAd"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassifiedAd_status_createdAt_idx" ON "ClassifiedAd"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassifiedAd_status_category_idx" ON "ClassifiedAd"("status", "category");

-- CreateIndex
CREATE INDEX "AdPhoto_adId_sortOrder_idx" ON "AdPhoto"("adId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ClassifiedAd" ADD CONSTRAINT "ClassifiedAd_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPhoto" ADD CONSTRAINT "AdPhoto_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ClassifiedAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
