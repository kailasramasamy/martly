-- When a store went live through onboarding; the onboarding list keeps launched stores
ALTER TABLE "stores" ADD COLUMN "launched_at" TIMESTAMP(3);

-- Stores already launched from the wizard (only the wizard sets a size)
UPDATE "stores" SET "launched_at" = "updated_at" WHERE "size" IS NOT NULL AND "status" <> 'PENDING';
