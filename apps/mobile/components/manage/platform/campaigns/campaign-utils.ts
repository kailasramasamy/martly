import { BrandCampaignStatusLabels, type BrandCampaignStatus } from "@martly/shared/constants";
import { TONES } from "../../marketing/common";
import type { Campaign } from "../types";

const STATUS_TONES: Record<BrandCampaignStatus, (typeof TONES)[keyof typeof TONES]> = {
  DRAFT: TONES.slate,
  PENDING_PAYMENT: TONES.amber,
  IN_REVIEW: TONES.violet,
  SCHEDULED: TONES.blue,
  LIVE: TONES.green,
  ENDED: TONES.slate,
  REJECTED: TONES.red,
  CANCELLED: TONES.slate,
};

export const statusTone = (status: BrandCampaignStatus) => ({ label: BrandCampaignStatusLabels[status], ...STATUS_TONES[status] });

const short = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const dateRange = (c: Campaign) => `${short(c.startsAt)} – ${short(c.endsAt)}`;

/** How much was bought: weeks, or thousands of views for a view package */
export const lengthLabel = (c: Campaign) =>
  c.product.kind === "BRAND_CPM" ? `${c.quantity * 1000} views` : `${c.quantity} ${c.quantity === 1 ? "week" : "weeks"}`;

export function targetingText(c: Campaign): string {
  if (c.targetStoreIds.length) return `${c.targetStoreIds.length} selected store(s)`;
  const regions = [...c.targetStates, ...c.targetDistricts.map((d) => d.replace(":", ", "))];
  return regions.length ? regions.join(" · ") : "All stores";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** Where a campaign is in its run: days to start, day N of total with days left, or ended */
export function progressLabel(c: Pick<Campaign, "startsAt" | "endsAt">, now = Date.now()): string {
  const start = new Date(c.startsAt).getTime();
  const end = new Date(c.endsAt).getTime();
  if (now < start) {
    const until = Math.ceil((start - now) / DAY_MS);
    return until <= 1 && new Date(start).toDateString() === new Date(now).toDateString() ? "Starts today" : `Starts in ${days(until)}`;
  }
  if (now >= end) return "Ended";
  const total = Math.round((end - start) / DAY_MS);
  const day = Math.min(total, Math.floor((now - start) / DAY_MS) + 1);
  return day >= total ? `Day ${total} of ${total} · last day` : `Day ${day} of ${total} · ${days(total - day)} left`;
}
