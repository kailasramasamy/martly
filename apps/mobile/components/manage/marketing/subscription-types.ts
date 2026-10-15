import { TONES, type Tone } from "./common";

export interface SubscriptionItem {
  id: string;
  storeProductId: string;
  quantity: number;
  storeProduct?: {
    price: string | number;
    product?: { name: string; imageUrl?: string | null };
    variant?: { name: string } | null;
  };
}

export interface Subscription {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  frequency: string;
  selectedDays: number[];
  deliveryAddress: string;
  nextDeliveryDate: string;
  pausedUntil: string | null;
  autoPayWithWallet: boolean;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  store: { id: string; name: string };
  items: SubscriptionItem[];
  skippedDates?: { id: string; date: string; reason: string | null }[];
  orders?: { id: string; status: string; paymentStatus: string; totalAmount: string | number; createdAt: string }[];
}

export interface StoreSubscriptionConfig {
  id: string;
  name: string;
  subscriptionEnabled: boolean;
  subscriptionDeliveryMode: "DEDICATED" | "SLOT_BASED";
  subscriptionWindowStart: string | null;
  subscriptionWindowEnd: string | null;
  subscriptionCutoffTime: string;
}

export interface SubscriptionConfigData {
  organization: { id: string; name: string; subscriptionEnabled: boolean };
  stores: StoreSubscriptionConfig[];
}

export const SUBSCRIPTION_STATUS: Record<Subscription["status"], Tone> = {
  ACTIVE: { label: "Active", ...TONES.green },
  PAUSED: { label: "Paused", ...TONES.amber },
  CANCELLED: { label: "Cancelled", ...TONES.red },
};

export const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "Daily",
  ALTERNATE_DAYS: "Alternate days",
  SPECIFIC_DAYS: "Specific days",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
};

export function itemsSummary(items: SubscriptionItem[]): string {
  return items.map((i) => `${i.quantity}x ${i.storeProduct?.product?.name ?? "Item"}`).join(", ");
}
