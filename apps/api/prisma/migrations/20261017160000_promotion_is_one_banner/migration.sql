-- A promotion is one home-carousel banner; plans count promotions, not banner slots

-- Keep the oldest banner of any promotion that ended up with several
DELETE FROM "banners" b
USING "banners" older
WHERE b."promo_id" IS NOT NULL AND older."promo_id" = b."promo_id"
  AND (older."created_at", older."id") < (b."created_at", b."id");

ALTER TABLE "banners" DROP COLUMN "slot_free";
ALTER TABLE "ad_products" DROP COLUMN "banner_slots";

-- AI images included per month: Free 0, Growth 2, Pro 6
UPDATE "ad_products" SET "ai_images_per_month" = CASE "code" WHEN 'GROWTH' THEN 2 WHEN 'PRO' THEN 6 ELSE 0 END
WHERE "kind" = 'STORE_PLAN';

-- Every live promotion shows in the carousel; only brand campaigns keep a cap there
UPDATE "marketing_config" SET "slot_limits" = "slot_limits" #- '{HERO_CAROUSEL,STORE}' #- '{HERO_CAROUSEL,PLATFORM}';
