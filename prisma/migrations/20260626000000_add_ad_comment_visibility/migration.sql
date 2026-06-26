ALTER TABLE "AdComment"
ADD COLUMN IF NOT EXISTS "isAdminOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AdComment_paymentId_isAdminOnly_createdAt_idx"
ON "AdComment"("paymentId", "isAdminOnly", "createdAt");
