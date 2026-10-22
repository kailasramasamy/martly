-- Featured brands become a paid brand campaign package, bought per category and aimed like other campaigns, replacing per-organisation picks
ALTER TYPE "AdProductKind" ADD VALUE 'BRAND_FEATURE';

ALTER TABLE "brand_campaigns" ALTER COLUMN "placement" DROP NOT NULL;

ALTER TABLE "marketing_config" ADD COLUMN "featured_brand_slots" INTEGER NOT NULL DEFAULT 2;

DROP TABLE "org_brand_features";
