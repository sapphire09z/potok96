-- Reversible account archival: preserve all foreign-key attribution for news and moderation.
ALTER TABLE "User" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "AdminUserArchive" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" VARCHAR(12) NOT NULL,
    "revokedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUserArchive_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminUserArchive_targetId_createdAt_idx" ON "AdminUserArchive"("targetId", "createdAt");
CREATE INDEX "AdminUserArchive_createdAt_idx" ON "AdminUserArchive"("createdAt");
