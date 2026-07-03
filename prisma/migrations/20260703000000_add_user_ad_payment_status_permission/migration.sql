ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "canEditAdPaymentStatus" BOOLEAN NOT NULL DEFAULT false;

UPDATE "public"."User"
SET "canEditAdPaymentStatus" = true
WHERE LOWER("email") IN ('cchee', 'cchee@gmail.com');
