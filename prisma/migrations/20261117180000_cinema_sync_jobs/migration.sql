-- Persistent audit and queue for the dedicated cinema sync worker.
-- Nothing here alters movies, sessions, or poster references.
CREATE TABLE "CinemaSyncRun" (
    "id" TEXT NOT NULL,
    "trigger" VARCHAR(12) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    "requestedById" VARCHAR(100),
    "movieCount" INTEGER,
    "sessionCount" INTEGER,
    "posterCandidates" INTEGER,
    "posterUpdated" INTEGER,
    "posterUnchanged" INTEGER,
    "posterSkipped" INTEGER,
    "posterFailures" INTEGER,
    "posterFullScan" BOOLEAN NOT NULL DEFAULT FALSE,
    "error" VARCHAR(1000),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CinemaSyncRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CinemaSyncRun_trigger_check" CHECK ("trigger" IN ('AUTO','MANUAL')),
    CONSTRAINT "CinemaSyncRun_status_check" CHECK ("status" IN ('QUEUED','RUNNING','SUCCEEDED','PARTIAL','FAILED'))
);
CREATE INDEX "CinemaSyncRun_createdAt_idx" ON "CinemaSyncRun"("createdAt");
CREATE INDEX "CinemaSyncRun_status_createdAt_idx" ON "CinemaSyncRun"("status", "createdAt");
-- Across app instances, only one pending job can exist at a time.
CREATE UNIQUE INDEX "CinemaSyncRun_one_queued_idx" ON "CinemaSyncRun" ((1)) WHERE "status" = 'QUEUED';
