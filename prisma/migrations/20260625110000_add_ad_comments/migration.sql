CREATE TABLE IF NOT EXISTS "AdComment" (
  "id" SERIAL PRIMARY KEY,
  "paymentId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdComment_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AdComment_paymentId_createdAt_idx"
  ON "AdComment"("paymentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdComment_userId_idx"
  ON "AdComment"("userId");
