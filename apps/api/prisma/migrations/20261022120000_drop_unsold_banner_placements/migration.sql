-- Category strip, mid-page, cart upsell and popup banners: nothing has created them since promotions replaced the banner
-- editor, and they'll be redesigned as placements Martly sells. The Home mid-banner section goes with them.
DELETE FROM "home_sections" WHERE "type" = 'MID_BANNERS';
DELETE FROM "banners" WHERE "placement" IN ('CATEGORY_STRIP', 'MID_PAGE', 'CART_UPSELL', 'POPUP');
UPDATE "marketing_config" SET "slot_limits" = "slot_limits" - 'CATEGORY_STRIP' - 'MID_PAGE' - 'CART_UPSELL' - 'POPUP';

ALTER TYPE "BannerPlacement" RENAME TO "BannerPlacement_old";
CREATE TYPE "BannerPlacement" AS ENUM ('HERO_CAROUSEL', 'CATEGORY_TOP', 'HOME_POSTER', 'SPONSORED_PRODUCT');
ALTER TABLE "banners" ALTER COLUMN "placement" TYPE "BannerPlacement" USING "placement"::text::"BannerPlacement";
ALTER TABLE "ad_products" ALTER COLUMN "placement" TYPE "BannerPlacement" USING "placement"::text::"BannerPlacement";
ALTER TABLE "brand_campaigns" ALTER COLUMN "placement" TYPE "BannerPlacement" USING "placement"::text::"BannerPlacement";
DROP TYPE "BannerPlacement_old";

ALTER TYPE "HomeSectionType" RENAME TO "HomeSectionType_old";
CREATE TYPE "HomeSectionType" AS ENUM (
  'FESTIVE_HERO', 'MEMBER_CHIPS', 'HERO_BANNERS', 'BUY_AGAIN', 'RECENTLY_VIEWED', 'DEPARTMENT_GRID', 'BRAND_RAIL', 'PLUS_PROMO',
  'TIME_PICKS', 'DEALS', 'RECIPES', 'LIVE_CAMPAIGNS', 'OTHER_COLLECTIONS', 'CATEGORY_DIRECTORY', 'OFFERS', 'BRAND_POSTERS',
  'PERSONALISED', 'PRODUCT_ROW', 'CAMPAIGN_CARD', 'TABBED_ROW', 'PRICE_BAND_DEALS', 'BRAND_CARD', 'EXPLORE_GRID', 'STORE_GRID'
);
ALTER TABLE "home_sections" ALTER COLUMN "type" TYPE "HomeSectionType" USING "type"::text::"HomeSectionType";
DROP TYPE "HomeSectionType_old";
