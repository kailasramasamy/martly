-- Brand posters and sponsored products, sold weekly to brands (editable on the pricing page)
INSERT INTO "ad_products" ("id", "kind", "code", "name", "description", "price", "duration_days", "placement", "sort_order", "updated_at")
VALUES
  (gen_random_uuid(), 'BRAND_BANNER', 'BRAND_POSTER_WEEK', 'Brand poster', 'A tall poster in the Home brand rail of every store that stocks the brand, per week', 6000, 7, 'HOME_POSTER', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BRAND_SPONSORED_PRODUCT', 'SPONSORED_PRODUCT_WEEK', 'Sponsored product', 'One product placed second in Home rows and listings of its category, marked Ad, per week', 3000, 7, 'SPONSORED_PRODUCT', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Up to 4 brand posters at once, and 2 sponsored products per category; limits already set are kept
UPDATE "marketing_config"
SET "slot_limits" = ('{"HOME_POSTER": {"BRAND": 4}, "SPONSORED_PRODUCT": {"BRAND": 2}}'::jsonb || "slot_limits"::jsonb)::json
WHERE "id" = 'default';
