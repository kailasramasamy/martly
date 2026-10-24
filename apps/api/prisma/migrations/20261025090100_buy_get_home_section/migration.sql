-- Saved Home layouts get the buy X get Y row right after Deals of the Day (at the end when they have no Deals row);
-- organisations without a saved layout pick it up from the default order
WITH placed AS (
  SELECT s.organization_id,
         COALESCE(MAX(s.sort_order) FILTER (WHERE s.type = 'DEALS'), MAX(s.sort_order)) + 1 AS slot
  FROM home_sections s
  WHERE NOT EXISTS (SELECT 1 FROM home_sections b WHERE b.organization_id = s.organization_id AND b.type = 'BUY_GET_DEALS')
  GROUP BY s.organization_id
), shifted AS (
  UPDATE home_sections h SET sort_order = h.sort_order + 1, updated_at = NOW()
  FROM placed p
  WHERE h.organization_id = p.organization_id AND h.sort_order >= p.slot
)
INSERT INTO home_sections (id, organization_id, type, config, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, organization_id, 'BUY_GET_DEALS', '{}'::jsonb, slot, true, NOW(), NOW() FROM placed;
