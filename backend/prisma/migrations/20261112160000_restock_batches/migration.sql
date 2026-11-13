-- Group restock lines into numbered restocks (RST-01, RST-02, ...).

ALTER TABLE "Business" ADD COLUMN "lastRestockSequence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Restock" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Restock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Restock_businessId_sequence_key" ON "Restock"("businessId", "sequence");
CREATE INDEX "Restock_businessId_idx" ON "Restock"("businessId");

ALTER TABLE "Restock"
  ADD CONSTRAINT "Restock_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestockLog" ADD COLUMN "restockId" TEXT;
ALTER TABLE "RestockLog" ADD COLUMN "quantityBefore" DECIMAL(18,6);
ALTER TABLE "RestockLog" ADD COLUMN "quantityAfter" DECIMAL(18,6);

INSERT INTO "Restock" ("id", "businessId", "sequence", "notes", "createdAt")
SELECT
  'rst_' || l."id",
  l."businessId",
  ROW_NUMBER() OVER (PARTITION BY l."businessId" ORDER BY l."createdAt", l."id")::int,
  l."notes",
  l."createdAt"
FROM "RestockLog" AS l;

UPDATE "RestockLog" AS l
SET "restockId" = 'rst_' || l."id";

ALTER TABLE "RestockLog" ALTER COLUMN "restockId" SET NOT NULL;

ALTER TABLE "RestockLog"
  ADD CONSTRAINT "RestockLog_restockId_fkey"
  FOREIGN KEY ("restockId") REFERENCES "Restock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RestockLog_restockId_idx" ON "RestockLog"("restockId");

UPDATE "Business" AS b
SET "lastRestockSequence" = COALESCE(
  (SELECT MAX(r."sequence") FROM "Restock" AS r WHERE r."businessId" = b."id"),
  0
);
