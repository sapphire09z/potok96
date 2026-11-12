-- Stage 5.9.1: editable official notices, legacy Markdown remains untouched.
CREATE TYPE "OfficialNoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "OfficialNotice" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "issuer" VARCHAR(240) NOT NULL DEFAULT '',
    "locality" VARCHAR(200) NOT NULL DEFAULT '',
    "summary" VARCHAR(600) NOT NULL DEFAULT '',
    "sourceUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "status" "OfficialNoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "OfficialNotice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfficialNotice_slug_key" ON "OfficialNotice"("slug");
CREATE INDEX "OfficialNotice_status_date_idx" ON "OfficialNotice"("status", "date");
CREATE INDEX "OfficialNotice_createdById_createdAt_idx" ON "OfficialNotice"("createdById", "createdAt");
ALTER TABLE "OfficialNotice" ADD CONSTRAINT "OfficialNotice_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
