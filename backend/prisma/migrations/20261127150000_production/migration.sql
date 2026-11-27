CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "sourceQuantity" DECIMAL(18,6) NOT NULL,
    "resultItemId" TEXT NOT NULL,
    "resultQuantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Production_businessId_createdAt_idx" ON "Production"("businessId", "createdAt");

ALTER TABLE "Production" ADD CONSTRAINT "Production_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Production" ADD CONSTRAINT "Production_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Production" ADD CONSTRAINT "Production_resultItemId_fkey" FOREIGN KEY ("resultItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
