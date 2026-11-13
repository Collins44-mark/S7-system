ALTER TABLE "Business" ALTER COLUMN "receiptPaperWidthMm" DROP NOT NULL;
ALTER TABLE "Business" ALTER COLUMN "receiptPaperWidthMm" DROP DEFAULT;
UPDATE "Business" SET "receiptPaperWidthMm" = NULL WHERE "receiptPaperWidthMm" = 58;
