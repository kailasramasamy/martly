-- Storefront health: when a snapshot was last worked out, so the scheduler's 6-hour refresh survives restarts
ALTER TABLE "storefront_health_snapshots" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Brand cards and brand pages pick a brand's products
CREATE INDEX IF NOT EXISTS "products_brand_id_idx" ON "products"("brand_id");
