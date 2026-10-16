export interface FleetSettings {
  maxOrdersPerTrip: number;
  maxTripsPerRider: number;
  expressBatchSize: number;
  expressMaxWaitMinutes: number;
  autoPlan: boolean;
}

export interface FleetRider {
  id: string;
  name: string;
  phone: string | null;
}

export interface RosterSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  cutoffMinutes: number;
  maxOrders: number;
  riderIds: string[];
}

export interface RosterData {
  riders: FleetRider[];
  slots: RosterSlot[];
}

/** Monday first, matching how a store thinks of its week; values are the API's dayOfWeek (0 = Sunday) */
export const WEEK_DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export interface SlotWindow {
  key: string;
  startTime: string;
  endTime: string;
  byDay: Map<number, RosterSlot>;
}

export function groupWindows(slots: RosterSlot[]): SlotWindow[] {
  const windows = new Map<string, SlotWindow>();
  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    const win = windows.get(key) ?? { key, startTime: slot.startTime, endTime: slot.endTime, byDay: new Map() };
    win.byDay.set(slot.dayOfWeek, slot);
    windows.set(key, win);
  }
  return [...windows.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}
