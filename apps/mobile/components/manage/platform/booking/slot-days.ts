import type { CalendarDay } from "../types";

export type DayState = "open" | "later" | "full";

/** Full when no start fits; open from the day's first moment (any time today); otherwise opens later that day */
export function dayState(day: CalendarDay, todayKey: string): DayState {
  if (!day.startsAt) return "full";
  if (day.date === todayKey) return "open";
  return Date.parse(day.startsAt) === Date.parse(`${day.date}T00:00:00+05:30`) ? "open" : "later";
}

export const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

export const istDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
