import type { PlanStop, PlanTrip, PlanWave, TripPhase } from "./types";

export const TRIP_PHASE: Record<TripPhase, { label: string; color: string; bg: string }> = {
  PLANNED: { label: "Planned", color: "#475569", bg: "#e2e8f0" },
  CREATED: { label: "Assigned", color: "#b45309", bg: "#fef3c7" },
  IN_PROGRESS: { label: "On the road", color: "#6d28d9", bg: "#ede9fe" },
  COMPLETED: { label: "Done", color: "#15803d", bg: "#dcfce7" },
};

const PACKING = new Set(["PENDING", "CONFIRMED", "PREPARING"]);
const IST = "Asia/Kolkata";

export const waveKey = (w: PlanWave) => w.slotId ?? "EXPRESS";
export const isUnstarted = (t: PlanTrip) => t.status === "PLANNED" || t.status === "CREATED";
export const orderCount = (w: PlanWave) => w.pool.length + w.trips.reduce((sum, t) => sum + t.stops.length, 0);

function istMinutes(now: Date): number {
  const [h, m] = now.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
  return Number(h) * 60 + Number(m);
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The slot running now, else the next one today, else the last; other days start at the first wave */
export function defaultWaveKey(waves: PlanWave[], isToday: boolean, now = new Date()): string | null {
  const slots = waves.filter((w) => w.kind === "SLOT" && w.startTime && w.endTime);
  if (!isToday && waves.length > 0) return waveKey(waves[0]);
  const minutes = istMinutes(now);
  const current = slots.find((w) => toMinutes(w.startTime!) <= minutes && minutes < toMinutes(w.endTime!));
  const upcoming = slots.find((w) => toMinutes(w.startTime!) > minutes);
  const pick = current ?? upcoming ?? slots[slots.length - 1] ?? waves[0];
  return pick ? waveKey(pick) : null;
}

export function cutoffText(wave: PlanWave, now = new Date()): string | null {
  if (!wave.cutoffAt) return null;
  const at = new Date(wave.cutoffAt);
  const time = at.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false });
  return `Cutoff ${time}${at.getTime() < now.getTime() ? " · passed" : ""}`;
}

export function tripStats(trip: PlanTrip): string {
  const parts = [`${trip.stops.length} stop${trip.stops.length === 1 ? "" : "s"}`];
  if (trip.plannedDistanceM) parts.push(`${(trip.plannedDistanceM / 1000).toFixed(1)} km`);
  if (trip.plannedDurationS) parts.push(`${Math.max(1, Math.round(trip.plannedDurationS / 60))} min`);
  return parts.join(" · ");
}

export function poolSummary(pool: PlanStop[]): string {
  const packing = pool.filter((s) => PACKING.has(s.status)).length;
  const text = `${pool.length} not planned`;
  return packing > 0 ? `${text} · ${packing} packing` : text;
}

export const deliveredCount = (trip: PlanTrip) => trip.stops.filter((s) => s.status === "DELIVERED").length;
/** How fresh the rider's position is; riders send every few seconds while the app is open */
export function lastSeenText(live: PlanTrip["live"], now = Date.now()): string {
  if (!live) return "Location not shared";
  const minutes = Math.floor((now - new Date(live.updatedAt).getTime()) / 60_000);
  return minutes < 1 ? "Seen just now" : `Last seen ${minutes} min ago`;
}

export const firstName = (name: string) => name.split(" ")[0];
