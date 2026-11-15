-- Stage 5.9.3: PostgreSQL-backed city service alerts. Legacy Markdown untouched.
CREATE TYPE "ServiceAlertStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "ServiceAlert" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "service" VARCHAR(32) NOT NULL,
    "state" VARCHAR(24) NOT NULL,
    "urgency" VARCHAR(16) NOT NULL DEFAULT 'normal',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL,
    "expectedEndAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "addresses" VARCHAR(1000) NOT NULL DEFAULT '',
    "source" VARCHAR(240) NOT NULL DEFAULT '',
    "sourceUrl" VARCHAR(2048) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "status" "ServiceAlertStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "ServiceAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceAlert_slug_key" ON "ServiceAlert"("slug");
CREATE INDEX "ServiceAlert_status_state_startAt_idx" ON "ServiceAlert"("status", "state", "startAt");
CREATE INDEX "ServiceAlert_createdById_createdAt_idx" ON "ServiceAlert"("createdById", "createdAt");
ALTER TABLE "ServiceAlert" ADD CONSTRAINT "ServiceAlert_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
