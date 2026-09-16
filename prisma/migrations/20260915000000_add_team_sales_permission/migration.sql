BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "UserSalesPermission" (
    "userId" INTEGER NOT NULL,
    "canViewTeamSales" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSalesPermission_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserSalesPermission"
ADD CONSTRAINT "UserSalesPermission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSalesPermission" ENABLE ROW LEVEL SECURITY;

COMMIT;
