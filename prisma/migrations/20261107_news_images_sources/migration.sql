-- Image library and provenance, without touching already published Markdown.
CREATE TYPE "NewsSourceKind" AS ENUM ('OWN', 'OFFICIAL', 'PRESS_RELEASE', 'THIRD_PARTY', 'OTHER');
ALTER TABLE "NewsPost"
  ADD COLUMN "sourceKind" "NewsSourceKind" NOT NULL DEFAULT 'OWN',
  ADD COLUMN "rightsNote" VARCHAR(2000),
  ADD COLUMN "coverImageId" VARCHAR(36);

CREATE TABLE "NewsImage" (
  "id" VARCHAR(36) NOT NULL,
  "postId" TEXT NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "caption" VARCHAR(240),
  "credit" VARCHAR(240),
  "rightsNote" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NewsImage_postId_sortOrder_idx" ON "NewsImage"("postId", "sortOrder");
ALTER TABLE "NewsImage" ADD CONSTRAINT "NewsImage_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "NewsPost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
