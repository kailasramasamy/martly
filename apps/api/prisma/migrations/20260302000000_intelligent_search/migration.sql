-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable: add search_text column
ALTER TABLE "products" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- CreateTable: search_aliases
CREATE TABLE "search_aliases" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on search_aliases.product_id
CREATE INDEX "search_aliases_product_id_idx" ON "search_aliases"("product_id");

-- AddForeignKey
ALTER TABLE "search_aliases" ADD CONSTRAINT "search_aliases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add search_vector column (managed via trigger, not Prisma)
ALTER TABLE "products" ADD COLUMN "search_vector" TSVECTOR;

-- GIN trigram index on products.search_text
CREATE INDEX "products_search_text_trgm_idx" ON "products" USING GIN ("search_text" gin_trgm_ops);

-- GIN index on products.search_vector
CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector");

-- GIN trigram index on search_aliases.alias
CREATE INDEX "search_aliases_alias_trgm_idx" ON "search_aliases" USING GIN ("alias" gin_trgm_ops);

-- Trigger function: auto-populates search_text and search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_product_search() RETURNS trigger AS $$
DECLARE
  brand_name TEXT;
  category_name TEXT;
  parent_category_name TEXT;
BEGIN
  -- Fetch brand name
  SELECT name INTO brand_name FROM brands WHERE id = NEW.brand_id;

  -- Fetch category name and parent category name
  SELECT c.name, pc.name INTO category_name, parent_category_name
  FROM categories c
  LEFT JOIN categories pc ON c.parent_id = pc.id
  WHERE c.id = NEW.category_id;

  -- Build search_text: concat of name, brand, category, description, tags, ingredients
  NEW.search_text := COALESCE(NEW.name, '') || ' ' ||
                     COALESCE(brand_name, '') || ' ' ||
                     COALESCE(category_name, '') || ' ' ||
                     COALESCE(parent_category_name, '') || ' ' ||
                     COALESCE(NEW.description, '') || ' ' ||
                     COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
                     COALESCE(NEW.ingredients, '');

  -- Build search_vector with weights: name (A), brand+category (B), description+tags (C), ingredients (D)
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(brand_name, '') || ' ' || COALESCE(category_name, '') || ' ' || COALESCE(parent_category_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.ingredients, '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
CREATE TRIGGER trg_update_product_search
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_search();

-- Backfill existing products (trigger fires on UPDATE)
UPDATE products SET name = name;
