ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "canWritePosts" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "canWritePosts" = true
WHERE LOWER("email") IN ('cchee', 'cchee@gmail.com');

CREATE TABLE IF NOT EXISTS "CommunityPost" (
  "id" SERIAL NOT NULL,
  "boardType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "contentText" TEXT NOT NULL,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "authorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommunityPost_boardType_createdAt_idx"
ON "CommunityPost"("boardType", "createdAt");

CREATE INDEX IF NOT EXISTS "CommunityPost_authorId_idx"
ON "CommunityPost"("authorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CommunityPost_authorId_fkey'
  ) THEN
    ALTER TABLE "CommunityPost"
    ADD CONSTRAINT "CommunityPost_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
