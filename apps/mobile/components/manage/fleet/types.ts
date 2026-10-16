export interface RosterSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  cutoffMinutes: number;
  maxOrders: number;
  riderIds: string[];
}

export interface FleetRider {
  id: string;
  name: string;
  phone: string | null;
}

export interface RosterData {
  riders: FleetRider[];
  slots: RosterSlot[];
}

/** Every weekday's slot for one time window, e.g. all the 17:00–19:00 slots */
export interface RosterWindow {
  key: string;
  label: string;
  slots: RosterSlot[];
}
