import { strings } from "../../lib/i18n";
import { formatDate } from "../../lib/i18n/format";
import type { Store } from "../../lib/types";

export interface OpenState {
  isOpen: boolean;
  label: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function getOpenState(store: Store, now = new Date()): OpenState | null {
  if (!store.operatingStart || !store.operatingEnd) return null;
  const t = strings("home");
  const current = now.getHours() * 60 + now.getMinutes();
  const isOpen = current >= toMinutes(store.operatingStart) && current < toMinutes(store.operatingEnd);
  return isOpen
    ? { isOpen, label: t.openUntil(formatTime(store.operatingEnd)) }
    : { isOpen, label: t.closedUntil(formatTime(store.operatingStart)) };
}

export function getStoreArea(store: Store): string {
  return store.address.split(",")[0].trim();
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Driving distance and time when the road route is known, else how far away it is as the crow flies */
export function distanceText(store: Store): string | null {
  if (store.drive) return strings("home").driveText(formatDistance(store.drive.km), store.drive.minutes);
  return store.distance != null ? strings("home").awayText(formatDistance(store.distance)) : null;
}

export function getGreeting(now = new Date()): string {
  const hour = now.getHours();
  const t = strings("home");
  if (hour < 12) return t.goodMorning;
  if (hour < 17) return t.goodAfternoon;
  return t.goodEvening;
}

/** "Today", "Tomorrow" or the weekday for an IST date key */
export function dayLabel(dateKey: string, now = new Date()): string {
  const today = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(dateKey) - Date.parse(today)) / 86400000);
  const c = strings("common");
  if (diff === 0) return c.today;
  if (diff === 1) return c.tomorrow;
  return formatDate(`${dateKey}T00:00:00Z`, { weekday: "long", timeZone: "UTC" });
}
