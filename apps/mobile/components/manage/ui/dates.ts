/** Local-date helpers using "YYYY-MM-DD" strings so no timezone drift creeps into forms */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

/** "just now", "5m ago", "3h ago", else a date */
export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(iso);
}
