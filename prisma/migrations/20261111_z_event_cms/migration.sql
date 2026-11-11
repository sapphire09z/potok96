-- Stage 5.7.1: event CMS. Legacy Markdown events stay intact and read-only.
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "EventPost" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "category" VARCHAR(32) NOT NULL DEFAULT 'other',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "location" VARCHAR(240) NOT NULL DEFAULT '',
  "price" VARCHAR(80) NOT NULL DEFAULT '',
  "isFree" BOOLEAN NOT NULL DEFAULT false,
  "pushkinCard" BOOLEAN NOT NULL DEFAULT false,
  "pushkinProofUrl" VARCHAR(2048) NOT NULL DEFAULT '',
  "summary" VARCHAR(600) NOT NULL DEFAULT '',
  "cover" VARCHAR(512) NOT NULL DEFAULT '',
  "orgSlug" VARCHAR(160) NOT NULL DEFAULT '',
  "video" VARCHAR(2048) NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "EventPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventPost_slug_key" ON "EventPost"("slug");
CREATE INDEX "EventPost_status_startAt_idx" ON "EventPost"("status", "startAt");
CREATE INDEX "EventPost_category_startAt_idx" ON "EventPost"("category", "startAt");
CREATE INDEX "EventPost_createdById_createdAt_idx" ON "EventPost"("createdById", "createdAt");
ALTER TABLE "EventPost" ADD CONSTRAINT "EventPost_createdById_fkey"
 FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
