import type { Town } from "@martly/shared/types";

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string | null;
  status: string;
  organizationId: string;
  organizationName: string;
}

/** Full store record from GET /stores/:id; money fields arrive as Decimal strings */
export interface StoreDetail extends Omit<StoreRow, "organizationName"> {
  latitude: number | null;
  longitude: number | null;
  townId: string;
  town: Town;
  returnKeepThreshold: string | null;
  subscriptionEnabled: boolean;
  subscriptionDeliveryMode: "DEDICATED" | "SLOT_BASED";
  subscriptionWindowStart: string | null;
  subscriptionWindowEnd: string | null;
  subscriptionCutoffTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAssignment {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string; name: string; phone: string | null; role: string };
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  userStores: { store: { id: string; name: string; organization: { id: string; name: string } } }[];
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
  userStores: { store: { id: string; name: string } }[];
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  festivalRegions: string[];
  promoDiscountCap: number;
}
