import type { PrismaClient } from "../../generated/prisma/client.js";

// pg_trgm similarity a misspelt word needs to a catalogue word before we swap it ("deterget" → "detergent")
const MIN_SIMILARITY = 0.3;

/**
 * Per-word spelling correction against the words in this store's product and brand names and aisle search terms.
 * Known words are kept as typed; returns undefined when nothing changed.
 */
export async function correctQuery(prisma: PrismaClient, storeId: string, q: string): Promise<string | undefined> {
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length === 0) return undefined;
  const rows = await prisma.$queryRaw<{ token: string; best: string | null; known: boolean }[]>`
    WITH vocab AS (
      SELECT DISTINCT w FROM products p
      JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active = true
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      CROSS JOIN LATERAL regexp_split_to_table(
        lower(p.name || ' ' || COALESCE(b.name, '') || ' ' || array_to_string(COALESCE(s.search_terms, '{}'), ' ')), '[^a-z]+'
      ) AS w
      WHERE p.is_active = true AND length(w) >= 3
    )
    SELECT t.token,
      EXISTS (SELECT 1 FROM vocab WHERE w = t.token) AS known,
      (SELECT w FROM vocab WHERE similarity(w, t.token) >= ${MIN_SIMILARITY}
        ORDER BY similarity(w, t.token) DESC, length(w) LIMIT 1) AS best
    FROM unnest(${tokens}::text[]) WITH ORDINALITY AS t(token, pos)
    ORDER BY t.pos`;
  const corrected = rows.map((r) => (r.known || r.token.length < 3 || !r.best ? r.token : r.best)).join(" ");
  return corrected !== q ? corrected : undefined;
}

/**
 * Finishes a half-typed last word with the commonest catalogue word it starts ("deter" → "detergent"),
 * so suggestions read as real searches. A last word that is already a catalogue word is left alone.
 */
export async function completeQuery(prisma: PrismaClient, storeId: string, q: string): Promise<string> {
  const tokens = q.split(" ").filter(Boolean);
  const last = tokens.at(-1);
  if (!last || last.length < 2) return q;
  const rows = await prisma.$queryRaw<{ w: string }[]>`
    SELECT w FROM products p
    JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active = true
    LEFT JOIN brands b ON b.id = p.brand_id
    CROSS JOIN LATERAL regexp_split_to_table(lower(p.name || ' ' || COALESCE(b.name, '')), '[^a-z0-9]+') AS w
    WHERE p.is_active = true AND w LIKE ${`${last.replace(/[%_\\]/g, "\\$&")}%`}
      -- Earlier words narrow the field: "surf exc" completes from Surf products to "excel", not "excellence"
      AND lower(p.name || ' ' || COALESCE(b.name, '')) LIKE ${`%${tokens.slice(0, -1).join(" ").replace(/[%_\\]/g, "\\$&")}%`}
    GROUP BY w
    ORDER BY (w = ${last}) DESC, COUNT(DISTINCT p.id) DESC, length(w)
    LIMIT 1`;
  return rows[0] ? [...tokens.slice(0, -1), rows[0].w].join(" ") : q;
}
