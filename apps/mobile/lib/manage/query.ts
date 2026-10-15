export type QueryValue = string | number | boolean | null | undefined;

/** Build a query string, dropping empty values: { a: 1, b: "" } → "?a=1" */
export function toQuery(params: Record<string, QueryValue>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
