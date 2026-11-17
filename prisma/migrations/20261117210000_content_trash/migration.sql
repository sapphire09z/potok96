-- Reversible editorial trash. No rows or S3 objects are deleted by this migration.
ALTER TYPE "NewsStatus" ADD VALUE IF NOT EXISTS 'TRASHED';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'TRASHED';

ALTER TABLE "NewsPost"
    ADD COLUMN "trashedAt" TIMESTAMPTZ(3),
    ADD COLUMN "trashedById" VARCHAR(100);
ALTER TABLE "EventPost"
    ADD COLUMN "trashedAt" TIMESTAMPTZ(3),
    ADD COLUMN "trashedById" VARCHAR(100);
CREATE INDEX "NewsPost_trashedAt_idx" ON "NewsPost"("trashedAt");
CREATE INDEX "EventPost_trashedAt_idx" ON "EventPost"("trashedAt");

CREATE TABLE "ContentTrashAudit" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "itemId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "actorId" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentTrashAudit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContentTrashAudit_kind_check" CHECK ("kind" IN ('news', 'events')),
    CONSTRAINT "ContentTrashAudit_action_check" CHECK ("action" IN ('trash', 'restore'))
);
CREATE INDEX "ContentTrashAudit_createdAt_idx" ON "ContentTrashAudit"("createdAt");
CREATE INDEX "ContentTrashAudit_kind_itemId_createdAt_idx" ON "ContentTrashAudit"("kind", "itemId", "createdAt");
