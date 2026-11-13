-- Per-business sequential order numbers: ORD-001, ORD-002, ...

ALTER TABLE "Business" ADD COLUMN "lastOrderSequence" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "Order_orderNumber_key";

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "businessId"
      ORDER BY "createdAt", id
    ) AS n
  FROM "Order"
)
UPDATE "Order" AS o
SET "orderNumber" = 'ORD-' || LPAD(ranked.n::text, 3, '0')
FROM ranked
WHERE o.id = ranked.id;

UPDATE "Business" AS b
SET "lastOrderSequence" = COALESCE(
  (SELECT COUNT(*)::int FROM "Order" AS o WHERE o."businessId" = b.id),
  0
);

CREATE UNIQUE INDEX "Order_businessId_orderNumber_key"
  ON "Order"("businessId", "orderNumber");
