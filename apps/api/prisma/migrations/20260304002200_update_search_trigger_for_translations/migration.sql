-- Update search trigger to include translation names in search_text and search_vector
CREATE OR REPLACE FUNCTION update_product_search() RETURNS trigger AS $$
DECLARE
  brand_name TEXT;
  category_name TEXT;
  parent_category_name TEXT;
  translation_names TEXT;
  lang_record RECORD;
BEGIN
  -- Fetch brand name
  SELECT name INTO brand_name FROM brands WHERE id = NEW.brand_id;

  -- Fetch category name and parent category name
  SELECT c.name, pc.name INTO category_name, parent_category_name
  FROM categories c
  LEFT JOIN categories pc ON c.parent_id = pc.id
  WHERE c.id = NEW.category_id;

  -- Collect all translation names into a single string
  translation_names := '';
  IF NEW.translations IS NOT NULL THEN
    FOR lang_record IN
      SELECT value->>'name' AS tname
      FROM jsonb_each(NEW.translations)
      WHERE value->>'name' IS NOT NULL
    LOOP
      translation_names := translation_names || ' ' || lang_record.tname;
    END LOOP;
  END IF;

  -- Build search_text: concat of name, translations, brand, category, description, tags, ingredients
  NEW.search_text := COALESCE(NEW.name, '') || ' ' ||
                     COALESCE(TRIM(translation_names), '') || ' ' ||
                     COALESCE(brand_name, '') || ' ' ||
                     COALESCE(category_name, '') || ' ' ||
                     COALESCE(parent_category_name, '') || ' ' ||
                     COALESCE(NEW.description, '') || ' ' ||
                     COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
                     COALESCE(NEW.ingredients, '');

  -- Build search_vector with weights
  -- Use 'simple' dictionary for translation names (no stemming needed for Tamil/regional)
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(TRIM(translation_names), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(brand_name, '') || ' ' || COALESCE(category_name, '') || ' ' || COALESCE(parent_category_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.ingredients, '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: re-trigger search for all products to pick up any existing translations
UPDATE products SET name = name;
