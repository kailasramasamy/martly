/**
 * Paginates search results in relevance order while the route's own `where` (scope, filters) decides membership.
 * `rankedKeys` comes from the search engine (best first); each candidate row carries the key it is ranked by
 * (a product id — for store listings, the listing's product). Candidates matched some other way rank last.
 */
export async function fetchRankedPage<T extends { id: string }>(opts: {
  rankedKeys: string[];
  candidates: { id: string; key: string }[];
  fetchRows: (ids: string[]) => Promise<T[]>;
  skip: number;
  take: number;
}): Promise<{ rows: T[]; total: number }> {
  const rank = new Map(opts.rankedKeys.map((key, i) => [key, i]));
  const order = (key: string) => rank.get(key) ?? Number.MAX_SAFE_INTEGER;
  const ordered = [...opts.candidates]
    .sort((a, b) => order(a.key) - order(b.key) || a.id.localeCompare(b.id))
    .map((c) => c.id);
  const pageIds = ordered.slice(opts.skip, opts.skip + opts.take);
  const position = new Map(pageIds.map((id, i) => [id, i]));
  const rows = pageIds.length ? await opts.fetchRows(pageIds) : [];
  rows.sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  return { rows, total: ordered.length };
}
