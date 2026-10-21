-- Sponsored products now also run in search, suggestions and list orders; only rewords an untouched description
UPDATE "ad_products" SET "description" = 'One product marked Ad: second in Home rows and listings of its category, and first in matching searches, suggestions and voice or list orders, per week', "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'SPONSORED_PRODUCT_WEEK' AND "description" = 'One product placed second in Home rows and listings of its category, marked Ad, per week';
