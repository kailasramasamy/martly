-- AlterTable
ALTER TABLE "stores" ADD COLUMN "min_order_amount" DECIMAL(65,30),
ADD COLUMN "free_delivery_threshold" DECIMAL(65,30);
