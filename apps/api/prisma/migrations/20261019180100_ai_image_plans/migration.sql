-- New AI-image allowances per plan, only where an admin hasn't already changed them from the old defaults
UPDATE "ad_products" SET "ai_images_per_month" = 5, "description" = 'No promotions, 5 AI images a month' WHERE "code" = 'FREE' AND "ai_images_per_month" = 0;
UPDATE "ad_products" SET "ai_images_per_month" = 30, "description" = '2 promotions and 30 AI images a month' WHERE "code" = 'GROWTH' AND "ai_images_per_month" = 2;
UPDATE "ad_products" SET "ai_images_per_month" = 100, "description" = '6 promotions and 100 AI images a month, push notifications' WHERE "code" = 'PRO' AND "ai_images_per_month" = 6;

-- AI image packs: bought once, valid until used
INSERT INTO "ad_products" ("id", "kind", "code", "name", "description", "price", "duration_days", "ai_image_credits", "sort_order", "updated_at")
VALUES
  (gen_random_uuid(), 'AI_IMAGE_PACK', 'AI_IMAGES_25', '25 AI images', '25 more AI images, valid until used', 299, 30, 25, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AI_IMAGE_PACK', 'AI_IMAGES_100', '100 AI images', '100 more AI images, valid until used', 999, 30, 100, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
