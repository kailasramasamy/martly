-- The featured brand and tab slot packages, and one tab slot at a time; kept when they already exist
INSERT INTO "ad_products" ("id", "kind", "code", "name", "description", "price", "duration_days", "placement", "is_active", "sort_order", "updated_at")
VALUES
  (gen_random_uuid(), 'BRAND_FEATURE', 'FEATURED_BRAND_WEEK', 'Featured brand',
   'The brand''s products rank ahead in search, category pages and list orders, marked Featured, per week', 4000, 7, NULL, true, 5, now()),
  (gen_random_uuid(), 'BRAND_TAB_SLOT', 'BRAND_TAB_WEEK', 'Brand tab slot',
   'The brand''s logo in the app''s bottom bar, opening its brand page, per week', 10000, 7, 'BRAND_TAB', true, 6, now())
ON CONFLICT ("code") DO NOTHING;

UPDATE "marketing_config" SET "slot_limits" = jsonb_set("slot_limits", '{BRAND_TAB}', '{"BRAND": 1}')
WHERE NOT ("slot_limits" ? 'BRAND_TAB');
