-- Phase 5.3.2: publication actions are audited separately from approval.
-- No data is published by this migration itself.
ALTER TYPE "NewsWorkflowAction" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "NewsWorkflowAction" ADD VALUE IF NOT EXISTS 'UNPUBLISHED';
ALTER TYPE "NewsWorkflowAction" ADD VALUE IF NOT EXISTS 'REPUBLISHED';
