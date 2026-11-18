-- Fully paid orders may be saved with a customer name and no phone.
-- PostgreSQL unique constraints allow multiple NULLs, so walk-in customers do not collide.
ALTER TABLE "Customer" ALTER COLUMN "phone" DROP NOT NULL;
