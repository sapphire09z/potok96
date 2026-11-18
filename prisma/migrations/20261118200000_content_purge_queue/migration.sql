-- Stage 5.15.2.2: durable, manually managed purge requests.
-- No SQL DELETE, S3 deletion, job runner, or automatic purge is introduced.
CREATE TABLE "ContentPurgeRequest" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "itemId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "trashedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestedById" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastCheckedAt" TIMESTAMPTZ(3),
    "lastCheck" JSONB,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledById" VARCHAR(100),
    CONSTRAINT "ContentPurgeRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContentPurgeRequest_kind_check" CHECK ("kind" IN ('news', 'events')),
    CONSTRAINT "ContentPurgeRequest_status_check" CHECK ("status" IN ('PENDING', 'CANCELLED'))
);
CREATE UNIQUE INDEX "ContentPurgeRequest_kind_itemId_trashedAt_key"
    ON "ContentPurgeRequest"("kind", "itemId", "trashedAt");
CREATE INDEX "ContentPurgeRequest_status_createdAt_idx" ON "ContentPurgeRequest"("status", "createdAt");
CREATE INDEX "ContentPurgeRequest_kind_itemId_idx" ON "ContentPurgeRequest"("kind", "itemId");

CREATE TABLE "ContentPurgeRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" VARCHAR(100) NOT NULL,
    "action" VARCHAR(12) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPurgeRequestEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContentPurgeRequestEvent_action_check" CHECK ("action" IN ('CREATED', 'REQUEUED', 'CHECKED', 'CANCELLED'))
);
CREATE INDEX "ContentPurgeRequestEvent_requestId_createdAt_idx"
    ON "ContentPurgeRequestEvent"("requestId", "createdAt");
ALTER TABLE "ContentPurgeRequestEvent" ADD CONSTRAINT "ContentPurgeRequestEvent_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "ContentPurgeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
