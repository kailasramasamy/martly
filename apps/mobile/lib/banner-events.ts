import { AppState } from "react-native";
import { api } from "./api";

type EventType = "VIEW" | "TAP";

const FLUSH_MS = 15000;
const MAX_EVENTS = 100;
const MAX_COUNT = 20;

// Counts waiting to be sent, keyed storeId -> "bannerId:TYPE"
const queue = new Map<string, Map<string, number>>();
const seenViews = new Set<string>();
let timer: ReturnType<typeof setInterval> | null = null;

function record(storeId: string, bannerId: string, type: EventType) {
  const counts = queue.get(storeId) ?? new Map<string, number>();
  const key = `${bannerId}:${type}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  queue.set(storeId, counts);
  start();
}

/** A banner shown to the customer; counted once per banner per store for the app session */
export function recordBannerView(storeId: string | undefined, bannerId: string) {
  if (!storeId) return;
  const seenKey = `${storeId}:${bannerId}`;
  if (seenViews.has(seenKey)) return;
  seenViews.add(seenKey);
  record(storeId, bannerId, "VIEW");
}

export function recordBannerTap(storeId: string | undefined, bannerId: string) {
  if (storeId) record(storeId, bannerId, "TAP");
}

function toEvents(counts: Map<string, number>) {
  const events: { bannerId: string; type: EventType; count: number }[] = [];
  for (const [key, total] of counts) {
    const [bannerId, type] = key.split(":");
    for (let left = total; left > 0; left -= MAX_COUNT) events.push({ bannerId, type: type as EventType, count: Math.min(left, MAX_COUNT) });
  }
  return events;
}

async function flush() {
  const pending = [...queue];
  queue.clear();
  for (const [storeId, counts] of pending) {
    const events = toEvents(counts);
    for (let i = 0; i < events.length; i += MAX_EVENTS) {
      // Analytics must never break the app, so a failed batch is simply dropped
      await api.post("/api/v1/banners/events", { storeId, events: events.slice(i, i + MAX_EVENTS) }).catch(() => undefined);
    }
  }
}

function start() {
  if (timer) return;
  timer = setInterval(() => { if (queue.size > 0) void flush(); }, FLUSH_MS);
}

AppState.addEventListener("change", (state) => {
  if (state === "background" && queue.size > 0) void flush();
});
