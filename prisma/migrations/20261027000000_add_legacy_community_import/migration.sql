BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "authorNameSnapshot" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "legacySourceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityPost_legacySourceId_key" ON "CommunityPost"("legacySourceId");

CREATE TABLE IF NOT EXISTS "CommunityAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "CommunityAsset" ENABLE ROW LEVEL SECURITY;

COMMIT;
