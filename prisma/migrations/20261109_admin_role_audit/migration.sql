-- An append-only record of role changes performed through the admin API.
-- Actor and target identifiers are retained even if a user is later deleted.
CREATE TABLE "AdminRoleChange" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "oldRole" "UserRole" NOT NULL,
    "newRole" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminRoleChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminRoleChange_targetId_createdAt_idx" ON "AdminRoleChange"("targetId", "createdAt");
CREATE INDEX "AdminRoleChange_createdAt_idx" ON "AdminRoleChange"("createdAt");
