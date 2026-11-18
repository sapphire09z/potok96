-- Stage 5.15.2.3.1: immutable dry-run plans. NO DELETES or execution permissions.
CREATE TABLE "ContentPurgePlan" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "itemId" VARCHAR(100) NOT NULL,
    "trashedAt" TIMESTAMPTZ(3) NOT NULL,
    "materialUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
    "actorId" VARCHAR(100) NOT NULL,
    "status" VARCHAR(12) NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPurgePlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContentPurgePlan_kind_check" CHECK ("kind" IN ('news', 'events')),
    CONSTRAINT "ContentPurgePlan_status_check" CHECK ("status" IN ('WAITING', 'BLOCKED', 'STALE')),
    CONSTRAINT "ContentPurgePlan_digest_check" CHECK ("digest" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "ContentPurgePlan_requestId_createdAt_idx" ON "ContentPurgePlan"("requestId", "createdAt");
CREATE INDEX "ContentPurgePlan_kind_itemId_idx" ON "ContentPurgePlan"("kind", "itemId");
ALTER TABLE "ContentPurgePlan" ADD CONSTRAINT "ContentPurgePlan_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "ContentPurgeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Add a non-destructive audit verb. The old events remain untouched.
ALTER TABLE "ContentPurgeRequestEvent" DROP CONSTRAINT "ContentPurgeRequestEvent_action_check";
ALTER TABLE "ContentPurgeRequestEvent" ADD CONSTRAINT "ContentPurgeRequestEvent_action_check"
    CHECK ("action" IN ('CREATED', 'REQUEUED', 'CHECKED', 'CANCELLED', 'PLANNED'));
