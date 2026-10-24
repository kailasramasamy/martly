-- Saved Home layouts get the hero cards at the very top; organisations without a saved layout pick them up from the
-- default order
WITH placed AS (
  SELECT DISTINCT s.organization_id
  FROM home_sections s
  WHERE NOT EXISTS (SELECT 1 FROM home_sections h WHERE h.organization_id = s.organization_id AND h.type = 'HERO_CARDS')
), shifted AS (
  UPDATE home_sections h SET sort_order = h.sort_order + 1, updated_at = NOW()
  FROM placed p
  WHERE h.organization_id = p.organization_id
)
INSERT INTO home_sections (id, organization_id, type, config, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, organization_id, 'HERO_CARDS', '{}'::jsonb, 0, true, NOW(), NOW() FROM placed;
