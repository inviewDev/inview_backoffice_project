BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "AdComment" ADD COLUMN IF NOT EXISTS "authorNameSnapshot" TEXT;
ALTER TABLE "AdComment" ADD COLUMN IF NOT EXISTS "legacySourceId" TEXT;
ALTER TABLE "AdComment" ALTER COLUMN "userId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "AdComment_legacySourceId_key" ON "AdComment"("legacySourceId");

COMMIT;
