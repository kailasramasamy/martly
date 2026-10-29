export interface Totals { orders: number; total: number; net: number }

/** One order from GET /api/v1/marketing-admin/orders */
export interface AdOrderRow {
  id: string;
  number: string | null;
  status: string;
  quantity: number;
  total: number;
  paidAt: string | null;
  createdAt: string;
  /** Signed API path, valid for 15 minutes */
  invoiceUrl: string | null;
  product: { name: string; kind: string };
  organization: { name: string } | null;
  brand: { name: string } | null;
}

export interface OrdersMeta { revenue: { allTime: Totals; thisMonth: Totals } }

/** One organization from GET /api/v1/marketing-admin/subscribers */
export interface Subscriber {
  id: string;
  name: string;
  webStoreAlwaysOn: boolean;
  unlimitedListings: boolean;
  /** The first store's logo that has one */
  logoUrl: string | null;
  /** Where the first store is */
  town: { name: string; state: string } | null;
  stores: number;
  liveStores: number;
  plan: { name: string; code: string } | null;
  currentUntil: string | null;
  paidThrough: string | null;
}

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
