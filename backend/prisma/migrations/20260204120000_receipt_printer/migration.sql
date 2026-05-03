-- AlterTable
ALTER TABLE "Business" ADD COLUMN "lastReceiptSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN "receiptPaperWidthMm" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Business" ADD COLUMN "printReceiptAfterSale" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "receiptPrinterAddress" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "receiptNumber" TEXT;
