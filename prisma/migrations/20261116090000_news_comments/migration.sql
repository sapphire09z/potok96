-- Stage 5.13: per-article comments, premoderation, reports and action audit.
-- Existing news posts keep comments disabled by default.
CREATE TYPE "NewsCommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'DELETED');
CREATE TYPE "NewsCommentAction" AS ENUM ('APPROVE', 'REJECT', 'HIDE', 'DELETE');

ALTER TABLE "NewsPost" ADD COLUMN "commentsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "NewsComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" "NewsCommentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderationNote" VARCHAR(500),
    CONSTRAINT "NewsComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsCommentEvent" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "NewsCommentAction" NOT NULL,
    "fromStatus" "NewsCommentStatus" NOT NULL,
    "toStatus" "NewsCommentStatus" NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsCommentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsCommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsCommentReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsComment_postId_status_createdAt_idx" ON "NewsComment"("postId", "status", "createdAt");
CREATE INDEX "NewsComment_authorId_createdAt_idx" ON "NewsComment"("authorId", "createdAt");
CREATE INDEX "NewsComment_parentId_status_createdAt_idx" ON "NewsComment"("parentId", "status", "createdAt");
CREATE INDEX "NewsCommentEvent_commentId_createdAt_idx" ON "NewsCommentEvent"("commentId", "createdAt");
CREATE INDEX "NewsCommentReport_commentId_idx" ON "NewsCommentReport"("commentId");
CREATE INDEX "NewsCommentReport_userId_createdAt_idx" ON "NewsCommentReport"("userId", "createdAt");
CREATE UNIQUE INDEX "NewsCommentReport_commentId_userId_key" ON "NewsCommentReport"("commentId", "userId");

ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NewsComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsCommentEvent" ADD CONSTRAINT "NewsCommentEvent_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "NewsComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsCommentEvent" ADD CONSTRAINT "NewsCommentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsCommentReport" ADD CONSTRAINT "NewsCommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "NewsComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsCommentReport" ADD CONSTRAINT "NewsCommentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
