-- Product slugs for martlyshop.in/p/{slug}: made from the name once and kept when the name changes, so links stay put
CREATE OR REPLACE FUNCTION product_slug_base(name TEXT) RETURNS TEXT AS $$
  SELECT coalesce(nullif(left(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), 80), ''), 'product');
$$ LANGUAGE SQL IMMUTABLE;

ALTER TABLE "products" ADD COLUMN "slug" TEXT;

-- Oldest product keeps the bare name; later ones with the same name get -2, -3, ...
UPDATE "products" p SET "slug" = s.slug
FROM (
  SELECT "id", CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END AS slug
  FROM (
    SELECT "id", product_slug_base("name") AS base,
           row_number() OVER (PARTITION BY product_slug_base("name") ORDER BY "created_at", "id") AS rn
    FROM "products"
  ) ranked
) s
WHERE p."id" = s."id";

ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- New products get a slug without every create path having to make one
CREATE OR REPLACE FUNCTION set_product_slug() RETURNS TRIGGER AS $$
DECLARE
  base TEXT := product_slug_base(NEW."name");
  candidate TEXT := base;
  n INT := 1;
BEGIN
  IF NEW."slug" IS NOT NULL THEN RETURN NEW; END IF;
  WHILE EXISTS (SELECT 1 FROM "products" WHERE "slug" = candidate) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  NEW."slug" := candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_slug_before_insert BEFORE INSERT ON "products"
FOR EACH ROW EXECUTE FUNCTION set_product_slug();
