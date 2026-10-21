-- Brand promotions also show as a shoppable offer card on Home; only rewords an untouched description
UPDATE "ad_products" SET "description" = 'Discount on the brand''s products with a home banner and a shoppable offer card on Home, per week', "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'BRAND_PROMOTION_WEEK' AND "description" = 'Discount on the brand''s products with a home banner, per week';
