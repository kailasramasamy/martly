import type { BrandCampaignStatus } from "@martly/shared/constants";
import { fromDateKey, toDateKey } from "../../ui/dates";
import type { Campaign } from "../types";

const LIVE_STATUSES: BrandCampaignStatus[] = ["PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED", "LIVE"];
const UNCONFIRMED: BrandCampaignStatus[] = ["PENDING_PAYMENT", "IN_REVIEW"];

export const isShownByDefault = (c: Campaign) => LIVE_STATUSES.includes(c.status);
/** Not yet paid or approved, so drawn lighter */
export const isUnconfirmed = (c: Campaign) => UNCONFIRMED.includes(c.status);

export interface MonthCursor { y: number; m: number }

export const currentMonth = (): MonthCursor => {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() };
};

export const daysInMonth = ({ y, m }: MonthCursor) => new Date(y, m + 1, 0).getDate();
export const monthKey = ({ y, m }: MonthCursor, day: number) => toDateKey(new Date(y, m, day));

/** Sunday-first grid cells: null pads before the 1st, like CalendarGrid */
export function monthCells(cursor: MonthCursor): (string | null)[] {
  const lead = new Date(cursor.y, cursor.m, 1).getDay();
  const days = Array.from({ length: daysInMonth(cursor) }, (_, i) => monthKey(cursor, i + 1));
  const cells = [...Array<null>(lead).fill(null), ...days];
  // Whole weeks, so the grid's last row lines up
  return [...cells, ...Array<null>((7 - (cells.length % 7)) % 7).fill(null)];
}

/** A campaign runs on a day when it starts before the day ends and ends after the day starts */
export function runsOn(c: Campaign, dayKey: string): boolean {
  const start = fromDateKey(dayKey);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return new Date(c.startsAt) < end && new Date(c.endsAt) > start;
}

/** Campaigns running on each day of the month, keyed by "YYYY-MM-DD" */
export function campaignsByDay(campaigns: Campaign[], cursor: MonthCursor): Map<string, Campaign[]> {
  const map = new Map<string, Campaign[]>();
  for (let d = 1; d <= daysInMonth(cursor); d++) {
    const key = monthKey(cursor, d);
    map.set(key, campaigns.filter((c) => runsOn(c, key)));
  }
  return map;
}

export interface Bar { campaign: Campaign; from: number; to: number }

/** First and last day-of-month (1-based) a campaign covers, clipped to the month; null when it misses the month */
function spanInMonth(c: Campaign, cursor: MonthCursor): { from: number; to: number } | null {
  const monthStart = new Date(cursor.y, cursor.m, 1);
  const monthEnd = new Date(cursor.y, cursor.m + 1, 1);
  const start = new Date(Math.max(new Date(c.startsAt).getTime(), monthStart.getTime()));
  const end = new Date(Math.min(new Date(c.endsAt).getTime(), monthEnd.getTime()));
  if (start >= end) return null;
  return { from: start.getDate(), to: new Date(end.getTime() - 1).getDate() };
}

/** The month's bars in start order: each campaign clipped to the days it covers in the month */
export function monthBars(campaigns: Campaign[], cursor: MonthCursor): Bar[] {
  return campaigns
    .flatMap((campaign) => {
      const span = spanInMonth(campaign, cursor);
      return span ? [{ campaign, ...span }] : [];
    })
    .sort((a, b) => a.from - b.from || a.to - b.to);
}
