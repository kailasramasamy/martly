-- Store onboarding: shop size, aisle tiers and brand regions drive the proposed catalog; template orgs are storefront sources
CREATE TYPE "StoreSize" AS ENUM ('KIRANA', 'SUPERMARKET', 'HYPERMARKET');
CREATE TYPE "SubcategoryTier" AS ENUM ('ESSENTIAL', 'STANDARD', 'EXTENDED');

ALTER TABLE "brands" ADD COLUMN "regions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "organizations" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stores" ADD COLUMN "size" "StoreSize";
ALTER TABLE "subcategories" ADD COLUMN "tier" "SubcategoryTier" NOT NULL DEFAULT 'STANDARD';

UPDATE "organizations" SET "is_template" = true WHERE "slug" = 'martly-template';
