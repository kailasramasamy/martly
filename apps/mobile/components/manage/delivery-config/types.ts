export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface DeliveryZone {
  id: string;
  name: string;
  pincodes: string[];
  deliveryFee: string;
  estimatedMinutes: number;
  isActive: boolean;
  organizationId: string;
  stores: { store: { id: string; name: string } }[];
}

export interface DeliverySlot {
  id: string;
  storeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxOrders: number;
  cutoffMinutes: number;
  isActive: boolean;
}

export interface DeliveryTier {
  id: string;
  storeId: string;
  minDistance: number;
  maxDistance: number;
  deliveryFee: string;
  estimatedMinutes: number;
  isActive: boolean;
}

export interface ExpressConfig {
  isEnabled: boolean;
  etaMinutes: number | null;
  operatingStart: string | null;
  operatingEnd: string | null;
}
