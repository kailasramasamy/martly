import type { FastifyInstance } from "fastify";

export interface SubcategoryFacet {
  id: string;
  name: string;
  count: number;
}

export function countIds(ids: (string | null)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Subcategory breakdown of a result set (largest first) — powers the "Liquid · Powder · Bar" chips */
export async function subcategoryFacets(prisma: FastifyInstance["prisma"], counts: Map<string, number>): Promise<SubcategoryFacet[]> {
  if (counts.size === 0) return [];
  const subs = await prisma.subcategory.findMany({ where: { id: { in: [...counts.keys()] } }, select: { id: true, name: true } });
  return subs
    .map((s) => ({ id: s.id, name: s.name, count: counts.get(s.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Brand breakdown of a result set (largest first) — powers the brand chips under a catalog search */
export async function brandFacets(prisma: FastifyInstance["prisma"], counts: Map<string, number>): Promise<SubcategoryFacet[]> {
  if (counts.size === 0) return [];
  const brands = await prisma.brand.findMany({ where: { id: { in: [...counts.keys()] } }, select: { id: true, name: true } });
  return brands
    .map((b) => ({ id: b.id, name: b.name, count: counts.get(b.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Orders facets by their count over the whole search so chips keep their places while another facet narrows the counts */
export function inSearchOrder<F extends { id: string; name: string }>(facets: F[], searchCounts: Map<string, number>): F[] {
  return [...facets].sort((a, b) => (searchCounts.get(b.id) ?? 0) - (searchCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
}
