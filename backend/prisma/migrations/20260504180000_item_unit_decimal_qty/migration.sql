-- Add unit field + support decimal quantities across inventory and sales.
-- This migration is written to be safe on existing integer data by casting.

-- AddColumn
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'pcs';

-- AlterColumn: Item.quantity (Int -> Decimal)
ALTER TABLE "Item"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6)
  USING ("quantity"::DECIMAL(18,6));

-- AlterColumn: Item.lowStockThreshold (Int -> Decimal)
ALTER TABLE "Item"
  ALTER COLUMN "lowStockThreshold" TYPE DECIMAL(18,6)
  USING ("lowStockThreshold"::DECIMAL(18,6));

-- Keep default comparable to previous behavior
ALTER TABLE "Item" ALTER COLUMN "lowStockThreshold" SET DEFAULT 10;

-- AlterColumn: RestockLog.quantity (Int -> Decimal)
ALTER TABLE "RestockLog"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6)
  USING ("quantity"::DECIMAL(18,6));

-- AlterColumn: OrderItem.quantity (Int -> Decimal)
ALTER TABLE "OrderItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,6)
  USING ("quantity"::DECIMAL(18,6));

