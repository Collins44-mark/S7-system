ALTER TABLE "Production" ADD COLUMN "sourceQuantityAfter" DECIMAL(18,6);
ALTER TABLE "Production" ADD COLUMN "resultQuantityAfter" DECIMAL(18,6);

UPDATE "Production" AS production
SET "sourceQuantityAfter" = item.quantity
FROM "Item" AS item
WHERE item.id = production."sourceItemId"
  AND production."sourceQuantityAfter" IS NULL;

UPDATE "Production" AS production
SET "resultQuantityAfter" = item.quantity
FROM "Item" AS item
WHERE item.id = production."resultItemId"
  AND production."resultQuantityAfter" IS NULL;

ALTER TABLE "Production" ALTER COLUMN "sourceQuantityAfter" SET NOT NULL;
ALTER TABLE "Production" ALTER COLUMN "resultQuantityAfter" SET NOT NULL;
