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
  const current = now.getHours() * 60 + now.getMinutes();
  const isOpen = current >= toMinutes(store.operatingStart) && current < toMinutes(store.operatingEnd);
  return isOpen
    ? { isOpen, label: `Open · closes ${formatTime(store.operatingEnd)}` }
    : { isOpen, label: `Closed · opens ${formatTime(store.operatingStart)}` };
}

export function getStoreArea(store: Store): string {
  return store.address.split(",")[0].trim();
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Driving distance and time when the road route is known, else how far away it is as the crow flies */
export function distanceText(store: Store): string | null {
  if (store.drive) return `${formatDistance(store.drive.km)} · ${store.drive.minutes} min drive`;
  return store.distance != null ? `${formatDistance(store.distance)} away` : null;
}

export function getGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Today", "Tomorrow" or the weekday for an IST date key */
export function dayLabel(dateKey: string, now = new Date()): string {
  const today = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(dateKey) - Date.parse(today)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}
