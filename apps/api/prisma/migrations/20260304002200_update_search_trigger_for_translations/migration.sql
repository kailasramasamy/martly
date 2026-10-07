-- Update search trigger to include translation names in search_text (3-tier taxonomy)
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

  -- Fetch subcategory name and category name via 3-tier hierarchy
  SELECT s.name, c.name INTO category_name, parent_category_name
  FROM subcategories s
  LEFT JOIN categories c ON s.category_id = c.id
  LEFT JOIN departments d ON c.department_id = d.id
  WHERE s.id = NEW.subcategory_id;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: re-trigger search for all products to pick up any existing translations
UPDATE products SET name = name;
