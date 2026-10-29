import type { Settlement } from "../../../../lib/ledger-types";

export type AccountState = "VERIFIED" | "PENDING" | "MISSING";

/** One organization from GET /api/v1/ledger/platform/balances */
export interface Balance {
  id: string;
  organizationId: string;
  name: string;
  available: number;
  onHold: number;
  carried: number;
  balance: number;
  scheduled: number;
  due: number;
  payoutAccount: AccountState;
}

/** One payout from GET /api/v1/ledger/platform/settlements */
export interface QueueRow extends Settlement {
  organizationName: string;
  payoutAccount: { verified: boolean; accountLast4: string | null; upiVpa: string | null } | null;
}

/** One unverified account from GET /api/v1/ledger/platform/payout-accounts?pending=true */
export interface PendingAccount {
  id: string;
  organizationId: string;
  organizationName: string;
  accountHolder: string;
  accountLast4: string | null;
  ifsc: string | null;
  upiVpa: string | null;
  updatedAt: string;
}

/** One manual adjustment from GET /api/v1/ledger/platform/adjustments */
export interface Adjustment {
  id: string;
  amount: string | number;
  memo: string | null;
  storeName: string | null;
  organizationName: string;
  createdByName: string | null;
  createdAt: string;
}

export interface Due {
  id: string;
  organizationName: string;
  amount: number;
  status: "PENDING" | "PAID" | "CANCELLED";
  paidAt: string | null;
  offlineReference: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
}

export interface Option { value: string; label: string }

export const MEMO_PREFIX = "Adjustment by Martly: ";
