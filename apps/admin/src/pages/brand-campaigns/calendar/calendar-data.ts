import dayjs, { type Dayjs } from "dayjs";
import type { BrandCampaignStatus } from "@martly/shared/constants";
import type { Campaign } from "../types";

const SHOWN_STATUSES: BrandCampaignStatus[] = ["PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED", "LIVE"];
const UNCONFIRMED: BrandCampaignStatus[] = ["PENDING_PAYMENT", "IN_REVIEW"];

export const DAY_KEY = "YYYY-MM-DD";

export const isShownByDefault = (c: Campaign) => SHOWN_STATUSES.includes(c.status);
/** Not yet paid or approved, so drawn lighter */
export const isUnconfirmed = (c: Campaign) => UNCONFIRMED.includes(c.status);

/** First day of the month being viewed */
export const currentMonth = (): Dayjs => dayjs().startOf("month");

/** Sunday-first grid cells: null pads before the 1st */
export function monthCells(month: Dayjs): (string | null)[] {
  const days = Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1).format(DAY_KEY));
  return [...Array<null>(month.day()).fill(null), ...days];
}

/** A campaign runs on a day when it starts before the day ends and ends after the day starts */
export function runsOn(c: Campaign, dayKey: string): boolean {
  const start = dayjs(dayKey);
  return dayjs(c.startsAt).isBefore(start.add(1, "day")) && dayjs(c.endsAt).isAfter(start);
}

/** Campaigns running on each day of the month, keyed by "YYYY-MM-DD" */
export function campaignsByDay(campaigns: Campaign[], month: Dayjs): Map<string, Campaign[]> {
  const map = new Map<string, Campaign[]>();
  for (let d = 1; d <= month.daysInMonth(); d++) {
    const key = month.date(d).format(DAY_KEY);
    map.set(key, campaigns.filter((c) => runsOn(c, key)));
  }
  return map;
}

export interface Bar { campaign: Campaign; from: number; to: number; lane: number }

/** First and last day-of-month (1-based) a campaign covers, clipped to the month; null when it misses the month */
function spanInMonth(c: Campaign, month: Dayjs): { from: number; to: number } | null {
  const monthEnd = month.add(1, "month");
  const startsAt = dayjs(c.startsAt);
  const endsAt = dayjs(c.endsAt);
  const start = startsAt.isAfter(month) ? startsAt : month;
  const end = endsAt.isBefore(monthEnd) ? endsAt : monthEnd;
  if (!start.isBefore(end)) return null;
  return { from: start.date(), to: end.subtract(1, "millisecond").date() };
}

/** Lays bars on the earliest lane that is free by the bar's first day, so overlaps stack and gaps stay visible */
export function assignLanes(campaigns: Campaign[], month: Dayjs): { bars: Bar[]; laneCount: number } {
  const spans = campaigns
    .map((campaign) => ({ campaign, span: spanInMonth(campaign, month) }))
    .filter((s): s is { campaign: Campaign; span: { from: number; to: number } } => s.span !== null)
    .sort((a, b) => a.span.from - b.span.from || a.span.to - b.span.to);
  const laneEnds: number[] = [];
  const bars = spans.map(({ campaign, span }) => {
    let lane = laneEnds.findIndex((end) => end < span.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = span.to;
    return { campaign, from: span.from, to: span.to, lane };
  });
  return { bars, laneCount: Math.max(1, laneEnds.length) };
}
