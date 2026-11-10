-- Stage 5.6.1: organisation cards managed in PostgreSQL alongside legacy Markdown.
CREATE TYPE "OrgStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "type" VARCHAR(120) NOT NULL DEFAULT '',
    "category" VARCHAR(32) NOT NULL DEFAULT 'other',
    "area" VARCHAR(12) NOT NULL DEFAULT 'city',
    "locality" VARCHAR(120) NOT NULL DEFAULT 'Красноуфимск',
    "address" VARCHAR(240) NOT NULL DEFAULT '',
    "phone" VARCHAR(100) NOT NULL DEFAULT '',
    "hours" VARCHAR(600) NOT NULL DEFAULT '',
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "website" VARCHAR(2048) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "mapUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "vkUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "okUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "maxUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "logo" VARCHAR(512) NOT NULL DEFAULT '',
    "cover" VARCHAR(512) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "status" "OrgStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_status_title_idx" ON "Organization"("status", "title");
CREATE INDEX "Organization_category_area_idx" ON "Organization"("category", "area");
