import type { CatalogDraftSummary } from "@martly/shared/types";

export type DraftStatus = CatalogDraftSummary["status"];

export const DRAFT_STATUS: Record<DraftStatus, { label: string; color: string; bg: string }> = {
  QUEUED: { label: "Queued", color: "#475569", bg: "#e2e8f0" },
  PROCESSING: { label: "Processing", color: "#0e7490", bg: "#cffafe" },
  NEEDS_REVIEW: { label: "Needs review", color: "#b45309", bg: "#fef3c7" },
  PUBLISHED: { label: "Live", color: "#15803d", bg: "#dcfce7" },
  DUPLICATE: { label: "Already listed", color: "#4338ca", bg: "#e0e7ff" },
  FAILED: { label: "Failed", color: "#b91c1c", bg: "#fee2e2" },
  DISCARDED: { label: "Discarded", color: "#64748b", bg: "#f1f5f9" },
};

export const FILTER_STATUSES: DraftStatus[] = ["NEEDS_REVIEW", "QUEUED", "PROCESSING", "PUBLISHED", "DUPLICATE", "FAILED", "DISCARDED"];

export const isInFlight = (status: DraftStatus) => status === "QUEUED" || status === "PROCESSING";
