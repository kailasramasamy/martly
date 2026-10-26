-- The onboarding wizard reopens with the catalog adjustments and pricing last applied
ALTER TABLE "stores" ADD COLUMN "catalog_rules" JSONB;
