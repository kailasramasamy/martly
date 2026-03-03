/**
 * Timezone-safe date utilities for Martly.
 *
 * All Martly stores are in India (IST = UTC+5:30).
 * "Date-only" values (skip dates, delivery dates, overrides) are stored
 * as UTC midnight (e.g. "March 4" → 2026-03-04T00:00:00.000Z).
 *
 * "Today" and "tomorrow" are determined by IST, regardless of the
 * server's system timezone.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000; // +5h30m

/** Internal: get IST date/time components from a UTC Date */
function getISTComponents(utcDate: Date = new Date()) {
  const ist = new Date(utcDate.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    date: ist.getUTCDate(),
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
    day: ist.getUTCDay(),
  };
}

/** Today's date (in IST) as UTC midnight. */
export function todayIST(): Date {
  const { year, month, date } = getISTComponents();
  return new Date(Date.UTC(year, month, date));
}

/** Tomorrow's date (in IST) as UTC midnight. */
export function tomorrowIST(): Date {
  const d = todayIST();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** End of a UTC-midnight day: same day 23:59:59.999Z */
export function endOfDayUTC(d: Date): Date {
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Parse "YYYY-MM-DD" → UTC midnight Date. */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

/** Format a UTC-midnight Date → "YYYY-MM-DD". */
export function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Current IST time as "HH:MM" string (for scheduler cutoff comparison). */
export function currentISTTime(): string {
  const { hours, minutes } = getISTComponents();
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
