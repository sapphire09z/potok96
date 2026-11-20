-- Small recovery marker. Prevent restore after partial S3 cleanup.
-- No scheduled purge, approval workflow, or destructive SQL in migration.
ALTER TABLE "NewsPost" ADD COLUMN "purgeStartedAt" TIMESTAMPTZ(3);
ALTER TABLE "EventPost" ADD COLUMN "purgeStartedAt" TIMESTAMPTZ(3);

-- Durable minimal action audit, independent of the deleted post row.
ALTER TABLE "ContentTrashAudit" DROP CONSTRAINT "ContentTrashAudit_action_check";
ALTER TABLE "ContentTrashAudit" ADD CONSTRAINT "ContentTrashAudit_action_check"
  CHECK ("action" IN ('trash', 'restore', 'purge'));
