-- CreateEnum
CREATE TYPE "AdProductKind" AS ENUM ('STORE_PLAN', 'PROMOTION_TOPUP', 'BRAND_BANNER', 'BRAND_TAKEOVER', 'BRAND_PROMOTION', 'BRAND_CPM');

-- CreateEnum
CREATE TYPE "AdOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PromotionCreditReason" AS ENUM ('TOPUP', 'USED', 'REFUND', 'ADJUST');

-- CreateEnum
CREATE TYPE "PromoCharge" AS ENUM ('PLAN', 'TOPUP', 'BRAND', 'PLATFORM');

-- CreateEnum
CREATE TYPE "SponsorType" AS ENUM ('STORE', 'BRAND', 'PLATFORM');

-- CreateEnum
CREATE TYPE "BrandCampaignStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'IN_REVIEW', 'SCHEDULED', 'LIVE', 'ENDED', 'REJECTED', 'CANCELLED');

-- AlterEnum

-- AlterEnum

-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "brand_campaign_id" TEXT,
ADD COLUMN     "brand_id" TEXT,
ADD COLUMN     "sponsor_type" "SponsorType" NOT NULL DEFAULT 'STORE',
ADD COLUMN     "target_store_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "view_cap" INTEGER,
ADD COLUMN     "views_served" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allow_brand_ads" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billing_address" TEXT,
ADD COLUMN     "billing_name" TEXT,
ADD COLUMN     "billing_state" TEXT,
ADD COLUMN     "gstin" TEXT;

-- AlterTable
ALTER TABLE "promos" ADD COLUMN     "brand_campaign_id" TEXT,
ADD COLUMN     "charged_from" "PromoCharge",
ADD COLUMN     "regenerations" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "brand_id" TEXT;

-- CreateTable
CREATE TABLE "ad_products" (
    "id" TEXT NOT NULL,
    "kind" "AdProductKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "banner_slots" INTEGER,
    "promotion_credits" INTEGER NOT NULL DEFAULT 0,
    "push_included" BOOLEAN NOT NULL DEFAULT false,
    "placement" "BannerPlacement",
    "views_per_unit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "gst_percent" DECIMAL(4,2) NOT NULL DEFAULT 18,
    "slot_limits" JSONB NOT NULL DEFAULT '{}',
    "free_regenerations" INTEGER NOT NULL DEFAULT 2,
    "seller_name" TEXT NOT NULL DEFAULT 'Martly',
    "seller_gstin" TEXT,
    "seller_state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "seller_address" TEXT,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'MKT',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "organization_id" TEXT,
    "brand_id" TEXT,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "gst_percent" DECIMAL(4,2) NOT NULL,
    "cgst" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "AdOrderStatus" NOT NULL DEFAULT 'PENDING',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "billing" JSONB NOT NULL DEFAULT '{}',
    "offline_reference" TEXT,
    "created_by_id" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_invoice_counters" (
    "fy" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "marketing_invoice_counters_pkey" PRIMARY KEY ("fy")
);

-- CreateTable
CREATE TABLE "org_plan_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "ad_order_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reminder_sent_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_plan_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_credit_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "PromotionCreditReason" NOT NULL,
    "promo_id" TEXT,
    "ad_order_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_stats_daily" (
    "banner_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "taps" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "banner_stats_daily_pkey" PRIMARY KEY ("banner_id","store_id","date")
);

-- CreateTable
CREATE TABLE "org_brand_blocks" (
    "organization_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_brand_blocks_pkey" PRIMARY KEY ("organization_id","brand_id")
);

-- CreateTable
CREATE TABLE "brand_campaigns" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status" "BrandCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT,
    "brief" TEXT,
    "placement" "BannerPlacement" NOT NULL,
    "category_id" TEXT,
    "action_type" "BannerActionType" NOT NULL DEFAULT 'BRAND',
    "action_target" TEXT,
    "target_store_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discount_type" "DiscountType",
    "discount_value" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "ad_order_id" TEXT,
    "review_note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_campaign_opt_outs" (
    "campaign_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_campaign_opt_outs_pkey" PRIMARY KEY ("campaign_id","organization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_products_code_key" ON "ad_products"("code");

-- CreateIndex
CREATE INDEX "ad_products_kind_is_active_idx" ON "ad_products"("kind", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ad_orders_number_key" ON "ad_orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ad_orders_razorpay_order_id_key" ON "ad_orders"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_orders_razorpay_payment_id_key" ON "ad_orders"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "ad_orders_organization_id_created_at_idx" ON "ad_orders"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_orders_brand_id_created_at_idx" ON "ad_orders"("brand_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_orders_status_idx" ON "ad_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "org_plan_periods_ad_order_id_key" ON "org_plan_periods"("ad_order_id");

-- CreateIndex
CREATE INDEX "org_plan_periods_organization_id_ends_at_idx" ON "org_plan_periods"("organization_id", "ends_at");

-- CreateIndex
CREATE INDEX "promotion_credit_entries_organization_id_idx" ON "promotion_credit_entries"("organization_id");

-- CreateIndex
CREATE INDEX "banner_stats_daily_store_id_date_idx" ON "banner_stats_daily"("store_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "brand_campaigns_ad_order_id_key" ON "brand_campaigns"("ad_order_id");

-- CreateIndex
CREATE INDEX "brand_campaigns_brand_id_status_idx" ON "brand_campaigns"("brand_id", "status");

-- CreateIndex
CREATE INDEX "brand_campaigns_status_starts_at_idx" ON "brand_campaigns"("status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "banners_brand_campaign_id_key" ON "banners"("brand_campaign_id");

-- CreateIndex
CREATE INDEX "banners_brand_id_idx" ON "banners"("brand_id");

-- CreateIndex
CREATE INDEX "promos_brand_campaign_id_idx" ON "promos"("brand_campaign_id");

-- CreateIndex
CREATE INDEX "users_brand_id_idx" ON "users"("brand_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_brand_campaign_id_fkey" FOREIGN KEY ("brand_campaign_id") REFERENCES "brand_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_brand_campaign_id_fkey" FOREIGN KEY ("brand_campaign_id") REFERENCES "brand_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ad_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_plan_periods" ADD CONSTRAINT "org_plan_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_plan_periods" ADD CONSTRAINT "org_plan_periods_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ad_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_plan_periods" ADD CONSTRAINT "org_plan_periods_ad_order_id_fkey" FOREIGN KEY ("ad_order_id") REFERENCES "ad_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_credit_entries" ADD CONSTRAINT "promotion_credit_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_credit_entries" ADD CONSTRAINT "promotion_credit_entries_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_credit_entries" ADD CONSTRAINT "promotion_credit_entries_ad_order_id_fkey" FOREIGN KEY ("ad_order_id") REFERENCES "ad_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_stats_daily" ADD CONSTRAINT "banner_stats_daily_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_stats_daily" ADD CONSTRAINT "banner_stats_daily_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_brand_blocks" ADD CONSTRAINT "org_brand_blocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_brand_blocks" ADD CONSTRAINT "org_brand_blocks_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ad_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_ad_order_id_fkey" FOREIGN KEY ("ad_order_id") REFERENCES "ad_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaign_opt_outs" ADD CONSTRAINT "brand_campaign_opt_outs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "brand_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_campaign_opt_outs" ADD CONSTRAINT "brand_campaign_opt_outs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Banners with no organization are Martly's own
UPDATE "banners" SET "sponsor_type" = 'PLATFORM' WHERE "organization_id" IS NULL;

INSERT INTO "marketing_config" ("id", "updated_at") VALUES ('default', NOW()) ON CONFLICT DO NOTHING;
