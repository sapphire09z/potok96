-- The existing Markdown news feed remains untouched at this stage.
-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(600) NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "category" VARCHAR(48) NOT NULL DEFAULT 'город',
    "authorName" VARCHAR(120) NOT NULL DEFAULT 'Редакция Поток 96',
    "orgSlug" VARCHAR(160),
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "crosspost" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cover" VARCHAR(512),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER NOT NULL DEFAULT 99,
    "sourceName" VARCHAR(180),
    "sourceUrl" VARCHAR(2048),
    "sourceText" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");
CREATE INDEX "NewsPost_status_publishedAt_idx" ON "NewsPost"("status", "publishedAt");
CREATE INDEX "NewsPost_updatedAt_idx" ON "NewsPost"("updatedAt");
CREATE INDEX "NewsPost_createdById_createdAt_idx" ON "NewsPost"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
