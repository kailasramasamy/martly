-- Saved Home layouts get the store walk card right after Buy again (or at the end when a layout has no Buy again);
-- organisations without a saved layout pick it up from the default order
WITH placed AS (
  SELECT s.organization_id, COALESCE(MAX(s.sort_order) FILTER (WHERE s.type = 'BUY_AGAIN'), MAX(s.sort_order)) + 1 AS slot
  FROM home_sections s
  WHERE NOT EXISTS (SELECT 1 FROM home_sections h WHERE h.organization_id = s.organization_id AND h.type = 'STORE_WALK')
  GROUP BY s.organization_id
), shifted AS (
  UPDATE home_sections h SET sort_order = h.sort_order + 1, updated_at = NOW()
  FROM placed p
  WHERE h.organization_id = p.organization_id AND h.sort_order >= p.slot
)
INSERT INTO home_sections (id, organization_id, type, config, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, organization_id, 'STORE_WALK', '{}'::jsonb, slot, true, NOW(), NOW() FROM placed;
