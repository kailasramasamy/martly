import type { Store } from "../../lib/types";

export interface OpenState {
  isOpen: boolean;
  label: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(hhmm: string): string {
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

export function getGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
