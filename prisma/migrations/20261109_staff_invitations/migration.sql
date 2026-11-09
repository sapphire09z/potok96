-- Stage 5.3.5d: MODERATOR invitation only, granted after verified Mobile ID sign-in.
-- Audit IDs are plain text; an account can be removed without losing invitation history.
CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL,
    "phone" VARCHAR(24) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffInvitation_phone_createdAt_idx" ON "StaffInvitation"("phone", "createdAt");
CREATE INDEX "StaffInvitation_createdAt_idx" ON "StaffInvitation"("createdAt");
-- At most one pending (unconsumed and unrevoked) invitation per number.
CREATE UNIQUE INDEX "StaffInvitation_one_pending_phone_idx"
    ON "StaffInvitation"("phone")
    WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;
