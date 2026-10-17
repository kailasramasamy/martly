-- CreateEnum
CREATE TYPE "MarketingSubscriptionStatus" AS ENUM ('CREATED', 'ACTIVE', 'PENDING', 'HALTED', 'CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "ad_products" ADD COLUMN     "razorpay_plan_amount" INTEGER,
ADD COLUMN     "razorpay_plan_id" TEXT;

-- AlterTable
ALTER TABLE "org_plan_periods" ADD COLUMN     "is_trial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "trial_used_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "marketing_subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "razorpay_subscription_id" TEXT NOT NULL,
    "status" "MarketingSubscriptionStatus" NOT NULL DEFAULT 'CREATED',
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "start_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_subscriptions_razorpay_subscription_id_key" ON "marketing_subscriptions"("razorpay_subscription_id");

-- CreateIndex
CREATE INDEX "marketing_subscriptions_organization_id_status_idx" ON "marketing_subscriptions"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "marketing_subscriptions" ADD CONSTRAINT "marketing_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_subscriptions" ADD CONSTRAINT "marketing_subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ad_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Extra promotions cost more than a plan promotion, so a plan is always the better deal
UPDATE "ad_products" SET "price" = 599 WHERE "code" = 'PROMO_TOPUP';
