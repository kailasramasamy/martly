ALTER TYPE "AdProductKind" ADD VALUE 'LISTING_TOPUP';

CREATE TABLE "listing_credit_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "from_plan" BOOLEAN NOT NULL DEFAULT false,
    "reason" "PromotionCreditReason" NOT NULL,
    "product_id" TEXT,
    "ad_order_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_credit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listing_credit_entries_organization_id_idx" ON "listing_credit_entries"("organization_id");
CREATE INDEX "listing_credit_entries_product_id_idx" ON "listing_credit_entries"("product_id");

ALTER TABLE "listing_credit_entries" ADD CONSTRAINT "listing_credit_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "listing_credit_entries" ADD CONSTRAINT "listing_credit_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "listing_credit_entries" ADD CONSTRAINT "listing_credit_entries_ad_order_id_fkey" FOREIGN KEY ("ad_order_id") REFERENCES "ad_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
