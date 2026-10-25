-- Saved Home layouts get the monthly list card right after the hero cards (it only shows in a shopper's reminder week)
WITH placed AS (
  SELECT s.organization_id, COALESCE(MAX(s.sort_order) FILTER (WHERE s.type = 'HERO_CARDS'), -1) + 1 AS slot
  FROM home_sections s
  WHERE NOT EXISTS (SELECT 1 FROM home_sections h WHERE h.organization_id = s.organization_id AND h.type = 'MONTHLY_LIST')
  GROUP BY s.organization_id
), shifted AS (
  UPDATE home_sections h SET sort_order = h.sort_order + 1, updated_at = NOW()
  FROM placed p
  WHERE h.organization_id = p.organization_id AND h.sort_order >= p.slot
)
INSERT INTO home_sections (id, organization_id, type, config, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, organization_id, 'MONTHLY_LIST', '{}'::jsonb, slot, true, NOW(), NOW() FROM placed;
