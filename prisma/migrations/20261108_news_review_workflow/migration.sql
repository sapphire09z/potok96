-- This phase only approves content for future publication; it never exposes news publicly.
ALTER TYPE "NewsStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
CREATE TYPE "NewsWorkflowAction" AS ENUM ('SUBMITTED', 'RETURNED', 'APPROVED', 'REOPENED');
CREATE TABLE "NewsWorkflowEvent" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "NewsWorkflowAction" NOT NULL,
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsWorkflowEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NewsWorkflowEvent_postId_createdAt_idx" ON "NewsWorkflowEvent"("postId", "createdAt");
ALTER TABLE "NewsWorkflowEvent" ADD CONSTRAINT "NewsWorkflowEvent_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsWorkflowEvent" ADD CONSTRAINT "NewsWorkflowEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
