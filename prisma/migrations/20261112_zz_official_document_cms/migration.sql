-- Stage 5.9.2: normative document CMS. Existing Markdown documents are untouched.
CREATE TYPE "OfficialDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "OfficialDocument" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "number" VARCHAR(100) NOT NULL DEFAULT '',
    "date" VARCHAR(10) NOT NULL,
    "issuer" VARCHAR(240) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "privatePdfKey" VARCHAR(512),
    "publicPdfKey" VARCHAR(512),
    "status" "OfficialDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "OfficialDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfficialDocument_slug_key" ON "OfficialDocument"("slug");
CREATE INDEX "OfficialDocument_status_date_idx" ON "OfficialDocument"("status", "date");
CREATE INDEX "OfficialDocument_createdById_createdAt_idx" ON "OfficialDocument"("createdById", "createdAt");
ALTER TABLE "OfficialDocument" ADD CONSTRAINT "OfficialDocument_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
