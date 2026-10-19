-- CreateEnum
CREATE TYPE "ReturnRemedy" AS ENUM ('REFUND', 'REPLACE');

-- CreateEnum
CREATE TYPE "ReturnMethod" AS ENUM ('KEEP', 'NEXT_ORDER', 'AT_STORE');

-- CreateEnum
CREATE TYPE "RefuseReason" AS ENUM ('DAMAGED', 'EXPIRED', 'WRONG_ITEM', 'NOT_WANTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReturnRequestStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "ReturnRequestStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "refused_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refused_reason" "RefuseReason",
ADD COLUMN     "replaces_return_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "refused_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "return_request_items" ADD COLUMN     "restock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "collected_on_order_id" TEXT,
ADD COLUMN     "method" "ReturnMethod",
ADD COLUMN     "received_at" TIMESTAMP(3),
ADD COLUMN     "received_by" TEXT,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "remedy" "ReturnRemedy";

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "return_keep_threshold" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "return_requests_user_id_store_id_status_idx" ON "return_requests"("user_id", "store_id", "status");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_replaces_return_id_fkey" FOREIGN KEY ("replaces_return_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_collected_on_order_id_fkey" FOREIGN KEY ("collected_on_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every return approved before outcomes existed was refunded to the wallet and kept by the customer
UPDATE "return_requests" SET "remedy" = 'REFUND', "method" = 'KEEP', "refunded_at" = "resolved_at" WHERE "status" = 'APPROVED';
