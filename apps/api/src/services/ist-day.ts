/** Stores run on India time; a "day" on the delivery board is an IST calendar day, whatever the server's zone */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses an order can still move on from, so it stays on the board until handled */
export const OPEN_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;

export function istDateKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The IST day for a YYYY-MM-DD key (today when omitted): UTC instants bounding it, and whether it's today */
export function istDay(key?: string) {
  const today = istDateKey(new Date());
  const day = key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : today;
  const start = new Date(`${day}T00:00:00+05:30`);
  return { key: day, start, end: new Date(start.getTime() + DAY_MS - 1), isToday: day === today };
}

/** The current IST date key and minutes past IST midnight, for slot cutoffs */
export function istNow() {
  const local = new Date(Date.now() + IST_OFFSET_MS);
  return { key: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD key, independent of the server's zone */
export function istWeekday(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** A YYYY-MM-DD key shifted by whole days */
export function addDays(key: string, days: number): string {
  return new Date(new Date(`${key}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}
