-- Bring the deployed database in line with the current backoffice schema.
-- The guards make this migration tolerant of databases that were previously updated manually.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Level') THEN
    CREATE TYPE "public"."Level" AS ENUM ('대표', '파트장', '팀장', '과장', '대리', '주임', '사원');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role' AND e.enumlabel = '팀장'
    ) THEN
      ALTER TYPE "public"."Role" ADD VALUE '팀장';
    END IF;
  END IF;
END $$;

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "level" "public"."Level" NOT NULL DEFAULT '사원',
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT NOT NULL DEFAULT '010-0000-0000',
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3) NOT NULL DEFAULT '2000-01-01T00:00:00.000Z',
  ADD COLUMN IF NOT EXISTS "officePhoneNumber" TEXT;

CREATE TABLE IF NOT EXISTS "public"."Company" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "companyName" TEXT NOT NULL,
  "ceoName" TEXT NOT NULL,
  "businessRegNumber" TEXT NOT NULL,
  "birthDate" TEXT NOT NULL,
  "tel" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "postcode" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "detailAddress" TEXT,
  "companyUrl" TEXT,
  "companyEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Payment" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "companyId" INTEGER,
  "productName" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "approvedCompany" TEXT NOT NULL,
  "taxInvoice" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Payroll" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCancellations" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionSupport" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "educationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mealFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."SalesDetail" (
  "id" SERIAL NOT NULL,
  "payrollId" INTEGER NOT NULL,
  "registrationDate" TIMESTAMP(3),
  "product" TEXT NOT NULL,
  "approvedAmount" DOUBLE PRECISION NOT NULL,
  "vatExcludedSales" DOUBLE PRECISION NOT NULL,
  "actualCost" DOUBLE PRECISION NOT NULL,
  "safetyFund" DOUBLE PRECISION NOT NULL,
  "allowanceBase" DOUBLE PRECISION NOT NULL,
  "salesAllowance" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."CancellationDetail" (
  "id" SERIAL NOT NULL,
  "payrollId" INTEGER NOT NULL,
  "registrationDate" TIMESTAMP(3),
  "product" TEXT NOT NULL,
  "cancellationAmount" DOUBLE PRECISION NOT NULL,
  "vat" DOUBLE PRECISION NOT NULL,
  "cancellationBase" DOUBLE PRECISION NOT NULL,
  "safetyFund" DOUBLE PRECISION NOT NULL,
  "cancellationAllowance" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CancellationDetail_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_userId_fkey') THEN
    ALTER TABLE "public"."Company"
      ADD CONSTRAINT "Company_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_userId_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_companyId_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payroll_userId_fkey') THEN
    ALTER TABLE "public"."Payroll"
      ADD CONSTRAINT "Payroll_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesDetail_payrollId_fkey') THEN
    ALTER TABLE "public"."SalesDetail"
      ADD CONSTRAINT "SalesDetail_payrollId_fkey"
      FOREIGN KEY ("payrollId") REFERENCES "public"."Payroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CancellationDetail_payrollId_fkey') THEN
    ALTER TABLE "public"."CancellationDetail"
      ADD CONSTRAINT "CancellationDetail_payrollId_fkey"
      FOREIGN KEY ("payrollId") REFERENCES "public"."Payroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
