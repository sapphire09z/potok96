-- Stage 5.6.5a: requests to manage organization pages.
-- A phone-verified login is not sufficient evidence of authority to represent a business.
-- Only an ADMIN may review requests after independent verification.
CREATE TYPE "OrgClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

CREATE TABLE "OrgClaim" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "roleDescription" VARCHAR(120) NOT NULL,
    "evidenceNote" VARCHAR(1000) NOT NULL,
    "status" "OrgClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" VARCHAR(500),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "revocationNote" VARCHAR(500),
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgClaim_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrgClaim" ADD CONSTRAINT "OrgClaim_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrgClaim" ADD CONSTRAINT "OrgClaim_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "OrgClaim_status_createdAt_idx" ON "OrgClaim"("status", "createdAt");
CREATE INDEX "OrgClaim_requesterId_createdAt_idx" ON "OrgClaim"("requesterId", "createdAt");
CREATE INDEX "OrgClaim_orgId_status_idx" ON "OrgClaim"("orgId", "status");

-- Prevent duplicate pending requests from one person.
CREATE UNIQUE INDEX "OrgClaim_one_pending_pair_idx" ON "OrgClaim"("orgId", "requesterId")
    WHERE "status" = 'PENDING';
-- Exactly one ACTIVE approved representative can manage an organization at a time.
-- Historical rejected/revoked requests are retained.
CREATE UNIQUE INDEX "OrgClaim_one_approved_org_idx" ON "OrgClaim"("orgId")
    WHERE "status" = 'APPROVED';
