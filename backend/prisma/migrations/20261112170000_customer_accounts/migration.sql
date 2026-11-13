-- Prepaid customer accounts. Money left with the shop is deducted on a later sale.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ACCOUNT';

CREATE TYPE "AccountEntryKind" AS ENUM ('DEPOSIT', 'PURCHASE');

ALTER TABLE "Customer" ADD COLUMN "creditBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "AccountEntry" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "orderId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "balanceAfter" DECIMAL(14,2) NOT NULL,
  "kind" "AccountEntryKind" NOT NULL,
  "method" "PaymentMethod",
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountEntry_customerId_idx" ON "AccountEntry"("customerId");
CREATE INDEX "AccountEntry_businessId_idx" ON "AccountEntry"("businessId");
CREATE INDEX "AccountEntry_orderId_idx" ON "AccountEntry"("orderId");

ALTER TABLE "AccountEntry"
  ADD CONSTRAINT "AccountEntry_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountEntry"
  ADD CONSTRAINT "AccountEntry_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountEntry"
  ADD CONSTRAINT "AccountEntry_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
