-- CreateEnum
CREATE TYPE "WalletRechargeStatus" AS ENUM ('PENDING', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT';
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'MEMBERSHIP';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION';
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL';
ALTER TYPE "NotificationType" ADD VALUE 'WISHLIST_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'STORE_NOTICE';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_ORDER';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_STOCK';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_DELIVERY';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_SERVICE';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_MARKETING';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_TEAM';

-- AlterTable
ALTER TABLE "store_products" ADD COLUMN     "low_stock_threshold" INTEGER;

-- AlterTable
ALTER TABLE "wishlist_items" ADD COLUMN     "last_price" DECIMAL(10,2),
ADD COLUMN     "store_id" TEXT,
ADD COLUMN     "was_in_stock" BOOLEAN;

-- CreateTable
CREATE TABLE "alert_once" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_once_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "wallet_recharges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "WalletRechargeStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_recharges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_once_created_at_idx" ON "alert_once"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_recharges_razorpay_order_id_key" ON "wallet_recharges"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_recharges_razorpay_payment_id_key" ON "wallet_recharges"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "wallet_recharges_user_id_idx" ON "wallet_recharges"("user_id");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_recharges" ADD CONSTRAINT "wallet_recharges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

