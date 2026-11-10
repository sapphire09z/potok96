-- Stage 5.6.2: private organization images, with selected logo/cover references.
-- No existing media paths or organization rows are modified.
ALTER TABLE "Organization"
  ADD COLUMN "logoImageId" VARCHAR(36),
  ADD COLUMN "coverImageId" VARCHAR(36);

CREATE TABLE "OrgImage" (
  "id" VARCHAR(36) NOT NULL,
  "orgId" TEXT NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "caption" VARCHAR(240),
  "credit" VARCHAR(240),
  "rightsNote" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrgImage_orgId_sortOrder_idx" ON "OrgImage"("orgId", "sortOrder");
ALTER TABLE "OrgImage" ADD CONSTRAINT "OrgImage_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
