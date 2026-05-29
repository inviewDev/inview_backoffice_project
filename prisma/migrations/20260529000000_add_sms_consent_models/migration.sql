CREATE TABLE IF NOT EXISTS "SmsConsentToken" (
  "id" SERIAL PRIMARY KEY,
  "paymentId" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "phoneNumber" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "agreedIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsConsentToken_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SmsConsentToken_paymentId_createdAt_idx"
  ON "SmsConsentToken"("paymentId", "createdAt");

CREATE TABLE IF NOT EXISTS "SmsSendHistory" (
  "id" SERIAL PRIMARY KEY,
  "paymentId" INTEGER NOT NULL,
  "senderId" INTEGER,
  "phoneNumber" TEXT NOT NULL,
  "resultCode" TEXT NOT NULL,
  "resultText" TEXT,
  "token" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsSendHistory_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SmsSendHistory_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SmsSendHistory_paymentId_createdAt_idx"
  ON "SmsSendHistory"("paymentId", "createdAt");
