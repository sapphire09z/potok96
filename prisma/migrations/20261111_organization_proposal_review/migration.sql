-- Stage 5.6.5b2. Keep an append-only audit of every editorial decision.
CREATE TABLE "OrgProposalReviewEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgProposalReviewEvent_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OrgProposalReviewEvent" ADD CONSTRAINT "OrgProposalReviewEvent_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "OrgEditProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "OrgProposalReviewEvent_proposalId_createdAt_idx"
    ON "OrgProposalReviewEvent"("proposalId", "createdAt");
-- Returned submissions remain reserved to the same organization until revised or cancelled.
DROP INDEX "OrgEditProposal_one_active_org_idx";
CREATE UNIQUE INDEX "OrgEditProposal_one_active_org_idx" ON "OrgEditProposal"("orgId")
    WHERE "status" IN ('DRAFT', 'SUBMITTED', 'RETURNED');
