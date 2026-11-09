-- Immutable audit trail for revoking active session records and unused login grants.
-- IDs are plain text so a later account deletion does not erase this audit trail.
CREATE TABLE "AdminSessionRevocation" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "revokedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSessionRevocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSessionRevocation_targetId_createdAt_idx" ON "AdminSessionRevocation"("targetId", "createdAt");
CREATE INDEX "AdminSessionRevocation_createdAt_idx" ON "AdminSessionRevocation"("createdAt");
