CREATE TABLE IF NOT EXISTS "CommunityPostView" (
  "id" SERIAL NOT NULL,
  "postId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "viewDate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPostView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunityPostView_postId_userId_viewDate_key"
ON "CommunityPostView"("postId", "userId", "viewDate");

CREATE INDEX IF NOT EXISTS "CommunityPostView_userId_idx"
ON "CommunityPostView"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommunityPostView_postId_fkey'
  ) THEN
    ALTER TABLE "CommunityPostView"
    ADD CONSTRAINT "CommunityPostView_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommunityPostView_userId_fkey'
  ) THEN
    ALTER TABLE "CommunityPostView"
    ADD CONSTRAINT "CommunityPostView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
