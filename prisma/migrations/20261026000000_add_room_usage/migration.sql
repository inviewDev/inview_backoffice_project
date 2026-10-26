BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "RoomUsage" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "userTeam" TEXT,
    "startedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoomUsage_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RoomUsage_userId_idx" ON "RoomUsage"("userId");
ALTER TABLE "RoomUsage" ENABLE ROW LEVEL SECURITY;

INSERT INTO "RoomUsage" ("id")
VALUES ('training-1'), ('training-2'), ('training-3'), ('conference')
ON CONFLICT ("id") DO NOTHING;

COMMIT;
