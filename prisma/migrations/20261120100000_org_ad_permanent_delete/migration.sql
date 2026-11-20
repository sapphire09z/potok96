-- Manual permanent deletion. No records or S3 objects are deleted by the migration.
-- DELETING is a recoverable state for retries after partial S3 failure.
ALTER TYPE "AdStatus" ADD VALUE IF NOT EXISTS 'DELETING';
ALTER TYPE "OrgStatus" ADD VALUE IF NOT EXISTS 'DELETING';

-- Reuse the existing content deletion audit for these two additional kinds.
ALTER TABLE "ContentTrashAudit" DROP CONSTRAINT "ContentTrashAudit_kind_check";
ALTER TABLE "ContentTrashAudit" ADD CONSTRAINT "ContentTrashAudit_kind_check"
  CHECK ("kind" IN ('news', 'events', 'orgs', 'ads'));
