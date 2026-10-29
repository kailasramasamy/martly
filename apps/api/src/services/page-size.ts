// The largest page any list returns; the app's brand pickers fetch every brand (~700) in one page
export const MAX_PAGE_SIZE = 1000;

/**
 * Brings an oversized or non-numeric pageSize down to MAX_PAGE_SIZE, so no request can ask a route that reads it
 * unvalidated for an unbounded page. Clamped rather than refused: app builds already in the field keep working.
 */
export function clampPageSize(query: unknown) {
  if (!query || typeof query !== "object" || !("pageSize" in query)) return;
  const q = query as { pageSize: unknown };
  const size = Number(q.pageSize);
  if (!Number.isFinite(size) || size > MAX_PAGE_SIZE) q.pageSize = String(MAX_PAGE_SIZE);
}
