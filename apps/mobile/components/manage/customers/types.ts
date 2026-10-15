export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  _count?: { orders: number };
}

export interface CustomerAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export interface CustomerDetail extends CustomerSummary {
  referralCode: string | null;
  addresses: CustomerAddress[];
  _count: { orders: number; reviews: number };
}

export interface WalletTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

export interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
}

export interface CustomerOrder {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
}

export interface CustomerSubscription {
  id: string;
  status: string;
  frequency: string;
  nextDeliveryDate: string | null;
  store: { id: string; name: string };
  items: { id: string; quantity: number; storeProduct: { product: { name: string }; variant: { name: string } } }[];
}

export const SUBSCRIPTION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Active", color: "#15803d", bg: "#dcfce7" },
  PAUSED: { label: "Paused", color: "#b45309", bg: "#fef3c7" },
  CANCELLED: { label: "Cancelled", color: "#b91c1c", bg: "#fee2e2" },
};

export const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "Daily",
  ALTERNATE_DAYS: "Alternate days",
  SPECIFIC_DAYS: "Specific days",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
};
