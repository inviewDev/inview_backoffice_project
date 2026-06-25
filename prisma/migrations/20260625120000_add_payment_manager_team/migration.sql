ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "managerTeam" TEXT;

UPDATE "Payment" payment
SET "managerTeam" = app_user."team"
FROM "User" app_user
WHERE payment."userId" = app_user."id"
  AND (payment."managerTeam" IS NULL OR btrim(payment."managerTeam") = '');
