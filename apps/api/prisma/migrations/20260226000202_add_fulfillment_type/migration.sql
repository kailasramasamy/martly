-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fulfillment_type" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY',
ALTER COLUMN "delivery_address" DROP NOT NULL;
