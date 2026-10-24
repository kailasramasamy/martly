-- AlterEnum
ALTER TYPE "HomeSectionType" ADD VALUE 'BUY_GET_DEALS';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "free_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "store_products" ADD COLUMN     "offer_buy_qty" INTEGER,
ADD COLUMN     "offer_end" TIMESTAMP(3),
ADD COLUMN     "offer_get_qty" INTEGER,
ADD COLUMN     "offer_start" TIMESTAMP(3);

