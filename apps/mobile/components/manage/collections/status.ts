import type { CollectionRecord } from "./types";

interface CollectionStatus {
  label: string;
  color: string;
  bg: string;
}

const INACTIVE: CollectionStatus = { label: "Inactive", color: "#475569", bg: "#f1f5f9" };
const SCHEDULED: CollectionStatus = { label: "Scheduled", color: "#1d4ed8", bg: "#dbeafe" };
const EXPIRED: CollectionStatus = { label: "Expired", color: "#475569", bg: "#f1f5f9" };
const LIVE: CollectionStatus = { label: "Active now", color: "#15803d", bg: "#dcfce7" };

export function collectionStatus(c: Pick<CollectionRecord, "isActive" | "startsAt" | "endsAt">, now = new Date()): CollectionStatus {
  if (!c.isActive) return INACTIVE;
  if (c.startsAt && new Date(c.startsAt) > now) return SCHEDULED;
  if (c.endsAt && new Date(c.endsAt) < now) return EXPIRED;
  return LIVE;
}
