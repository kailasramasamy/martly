import type { PrismaClient } from "../../../generated/prisma/client.js";

export interface CandidateVariant { id: string; name: string; mrp: number | null }

export interface Candidate {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategoryId: string;
  brand: { id: string; name: string; regions: string[]; popularity: number; regionalPopularity: Record<string, number> } | null;
  /** Units sold across Martly in the last 90 days */
  sold: number;
  variants: CandidateVariant[];
}

interface CandidateRow {
  id: string;
  name: string;
  image_url: string | null;
  subcategory_id: string;
  brand_id: string | null;
  brand_name: string | null;
  regions: string[] | null;
  popularity: number | null;
  regional_popularity: Record<string, number> | null;
  sold: number;
  variants: { id: string; name: string; mrp: string | null }[];
}

/** Every master product a new store could carry: active, launched, photographed, with its sizes and recent sales */
export async function loadCandidates(prisma: PrismaClient): Promise<Candidate[]> {
  const rows = await prisma.$queryRaw<CandidateRow[]>`
    SELECT p.id, p.name, p.image_url, p.subcategory_id, b.id AS brand_id, b.name AS brand_name, b.regions, b.popularity,
           (SELECT jsonb_object_agg(rp.region, rp.popularity) FROM brand_region_popularity rp WHERE rp.brand_id = b.id) AS regional_popularity,
           COALESCE(s.qty, 0)::int AS sold,
           json_agg(json_build_object('id', v.id, 'name', v.name, 'mrp', v.mrp) ORDER BY v.mrp NULLS LAST, v.name) AS variants
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS qty
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at > NOW() - INTERVAL '90 days'
      GROUP BY oi.product_id
    ) s ON s.product_id = p.id
    WHERE p.is_active AND NOT p.is_draft AND p.organization_id IS NULL
      AND p.image_url IS NOT NULL AND p.subcategory_id IS NOT NULL
    GROUP BY p.id, b.id, s.qty`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    imageUrl: r.image_url,
    subcategoryId: r.subcategory_id,
    brand: r.brand_id ? { id: r.brand_id, name: r.brand_name!, regions: r.regions ?? [], popularity: r.popularity ?? 0, regionalPopularity: r.regional_popularity ?? {} } : null,
    sold: r.sold,
    variants: r.variants.map((v) => ({ id: v.id, name: v.name, mrp: v.mrp === null ? null : Number(v.mrp) })),
  }));
}

export interface TaxonomyRow {
  department_id: string;
  department: string;
  category_id: string;
  category: string;
  subcategory_id: string;
  subcategory: string;
  tier: "ESSENTIAL" | "STANDARD" | "EXTENDED";
}

/** Aisles in shelf order, for the proposal tree */
export function loadTaxonomy(prisma: PrismaClient) {
  return prisma.$queryRaw<TaxonomyRow[]>`
    SELECT d.id AS department_id, d.name AS department, c.id AS category_id, c.name AS category,
           s.id AS subcategory_id, s.name AS subcategory, s.tier::text AS tier
    FROM subcategories s JOIN categories c ON c.id = s.category_id JOIN departments d ON d.id = c.department_id
    ORDER BY d.sort_order, d.name, c.sort_order, c.name, s.sort_order, s.name`;
}
