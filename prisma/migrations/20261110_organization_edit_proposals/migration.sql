-- Stage 5.6.5b1: representative draft proposals are NEVER applied to public organizations.
CREATE TYPE "OrgEditProposalStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED', 'CANCELLED'
);

CREATE TABLE "OrgEditProposal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "status" "OrgEditProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "baseOrgUpdatedAt" TIMESTAMP(3) NOT NULL,
    "baseFields" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" VARCHAR(1000),
    CONSTRAINT "OrgEditProposal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrgEditProposal" ADD CONSTRAINT "OrgEditProposal_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrgEditProposal" ADD CONSTRAINT "OrgEditProposal_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrgEditProposal" ADD CONSTRAINT "OrgEditProposal_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "OrgClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "OrgEditProposal_requesterId_createdAt_idx" ON "OrgEditProposal"("requesterId", "createdAt");
CREATE INDEX "OrgEditProposal_orgId_status_idx" ON "OrgEditProposal"("orgId", "status");
CREATE INDEX "OrgEditProposal_status_submittedAt_idx" ON "OrgEditProposal"("status", "submittedAt");
-- Only one live draft/review request per organization, even across concurrent requests.
CREATE UNIQUE INDEX "OrgEditProposal_one_active_org_idx" ON "OrgEditProposal"("orgId")
    WHERE "status" IN ('DRAFT', 'SUBMITTED');
