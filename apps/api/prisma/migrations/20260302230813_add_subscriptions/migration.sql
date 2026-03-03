-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('DAILY', 'ALTERNATE_DAYS', 'SPECIFIC_DAYS');

-- CreateEnum
CREATE TYPE "SubscriptionDeliveryMode" AS ENUM ('DEDICATED', 'SLOT_BASED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "is_subscription_order" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscription_id" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "subscription_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "subscription_cutoff_time" TEXT NOT NULL DEFAULT '22:00',
ADD COLUMN     "subscription_delivery_mode" "SubscriptionDeliveryMode" NOT NULL DEFAULT 'DEDICATED',
ADD COLUMN     "subscription_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscription_window_end" TEXT,
ADD COLUMN     "subscription_window_start" TEXT;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" "SubscriptionFrequency" NOT NULL,
    "selected_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "delivery_address" TEXT NOT NULL,
    "delivery_lat" DOUBLE PRECISION,
    "delivery_lng" DOUBLE PRECISION,
    "delivery_pincode" TEXT,
    "address_id" TEXT,
    "next_delivery_date" TIMESTAMP(3) NOT NULL,
    "cutoff_time" TEXT NOT NULL DEFAULT '22:00',
    "paused_until" TIMESTAMP(3),
    "auto_pay_with_wallet" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "store_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_skips" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_skips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "basket_add_ons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "store_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "basket_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_user_id_store_id_status_idx" ON "subscriptions"("user_id", "store_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_store_id_status_next_delivery_date_idx" ON "subscriptions"("store_id", "status", "next_delivery_date");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_items_subscription_id_store_product_id_key" ON "subscription_items"("subscription_id", "store_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_skips_subscription_id_date_key" ON "subscription_skips"("subscription_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "basket_add_ons_user_id_store_id_store_product_id_delivery_d_key" ON "basket_add_ons"("user_id", "store_id", "store_product_id", "delivery_date");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_skips" ADD CONSTRAINT "subscription_skips_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_add_ons" ADD CONSTRAINT "basket_add_ons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_add_ons" ADD CONSTRAINT "basket_add_ons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_add_ons" ADD CONSTRAINT "basket_add_ons_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
