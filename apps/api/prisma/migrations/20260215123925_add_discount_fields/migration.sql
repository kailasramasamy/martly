-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FLAT', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "discount_type" "DiscountType",
ADD COLUMN     "discount_value" DECIMAL(10,2),
ADD COLUMN     "original_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "discount_end" TIMESTAMP(3),
ADD COLUMN     "discount_start" TIMESTAMP(3),
ADD COLUMN     "discount_type" "DiscountType",
ADD COLUMN     "discount_value" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "store_products" ADD COLUMN     "discount_end" TIMESTAMP(3),
ADD COLUMN     "discount_start" TIMESTAMP(3),
ADD COLUMN     "discount_type" "DiscountType",
ADD COLUMN     "discount_value" DECIMAL(10,2);
