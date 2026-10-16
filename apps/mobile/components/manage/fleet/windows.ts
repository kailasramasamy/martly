import type { RosterSlot, RosterWindow } from "./types";

export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Groups the week's slots by time window, earliest first */
export function groupWindows(slots: RosterSlot[]): RosterWindow[] {
  const map = new Map<string, RosterWindow>();
  for (const slot of slots) {
    const key = `${slot.startTime}–${slot.endTime}`;
    const window = map.get(key) ?? { key, label: key, slots: [] };
    window.slots.push(slot);
    map.set(key, window);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Riders on at least one slot of the window, with how many days each works */
export function riderDays(window: RosterWindow): Map<string, number> {
  const days = new Map<string, number>();
  for (const slot of window.slots) {
    for (const id of slot.riderIds) days.set(id, (days.get(id) ?? 0) + 1);
  }
  return days;
}
