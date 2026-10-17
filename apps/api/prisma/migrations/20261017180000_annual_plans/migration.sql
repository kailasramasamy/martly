-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "ad_orders" ADD COLUMN     "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE "ad_products" ADD COLUMN     "razorpay_yearly_plan_amount" INTEGER,
ADD COLUMN     "razorpay_yearly_plan_id" TEXT,
ADD COLUMN     "yearly_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "marketing_subscriptions" ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';


-- Annual prices: 10 months for 12 (2 months free)
UPDATE "ad_products" SET "yearly_price" = CASE "code" WHEN 'GROWTH' THEN 9990 WHEN 'PRO' THEN 24990 END WHERE "code" IN ('GROWTH', 'PRO');
