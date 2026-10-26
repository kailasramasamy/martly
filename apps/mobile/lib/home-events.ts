import type { HomeSectionType } from "@martly/shared/constants";
import { api } from "./api";

export interface SectionSource {
  sectionId: string;
  sectionType: HomeSectionType;
}

type EventType = "VIEW" | "TAP" | "ADD";

const FLUSH_MS = 15000;
const MAX_EVENTS = 100;
const MAX_COUNT = 20;

// Counts waiting to be sent, keyed storeId -> "sectionId|sectionType|TYPE"
const queue = new Map<string, Map<string, number>>();
const seenViews = new Set<string>();
let timer: ReturnType<typeof setInterval> | null = null;

function record(storeId: string, source: SectionSource, type: EventType) {
  const counts = queue.get(storeId) ?? new Map<string, number>();
  const key = `${source.sectionId}|${source.sectionType}|${type}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  queue.set(storeId, counts);
  start();
}

/** A Home section the shopper scrolled to; counted once per section per store for the app session */
export function recordSectionView(storeId: string | undefined, source: SectionSource) {
  if (!storeId) return;
  const seenKey = `${storeId}:${source.sectionId}`;
  if (seenViews.has(seenKey)) return;
  seenViews.add(seenKey);
  record(storeId, source, "VIEW");
}

export function recordSectionTap(storeId: string | undefined, source: SectionSource) {
  if (storeId) record(storeId, source, "TAP");
}

export function recordSectionAdd(storeId: string | undefined, source: SectionSource) {
  if (storeId) record(storeId, source, "ADD");
}

function toEvents(counts: Map<string, number>) {
  const events: (SectionSource & { type: EventType; count: number })[] = [];
  for (const [key, total] of counts) {
    const [sectionId, sectionType, type] = key.split("|");
    for (let left = total; left > 0; left -= MAX_COUNT) {
      events.push({ sectionId, sectionType: sectionType as HomeSectionType, type: type as EventType, count: Math.min(left, MAX_COUNT) });
    }
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
      await api.post("/api/v1/home/events", { storeId, events: events.slice(i, i + MAX_EVENTS) }).catch(() => undefined);
    }
  }
}

function start() {
  if (timer) return;
  timer = setInterval(() => { if (queue.size > 0) void flush(); }, FLUSH_MS);
}
