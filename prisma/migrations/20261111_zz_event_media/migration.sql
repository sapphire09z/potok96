-- Stage 5.7.2: immutable originals/variants in private Selectel S3;
-- chosen cover is promoted to the public CDN before publication/selection.
ALTER TABLE "EventPost" ADD COLUMN "coverImageId" VARCHAR(36);

CREATE TABLE "EventImage" (
  "id" VARCHAR(36) NOT NULL,
  "eventId" TEXT NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "caption" VARCHAR(240),
  "credit" VARCHAR(240),
  "rightsNote" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventImage_eventId_sortOrder_idx" ON "EventImage"("eventId", "sortOrder");
ALTER TABLE "EventImage" ADD CONSTRAINT "EventImage_eventId_fkey"
 FOREIGN KEY ("eventId") REFERENCES "EventPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
