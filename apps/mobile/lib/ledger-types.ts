import type { LedgerEntryState, LedgerEntryType, SettlementStatus, PayoutMethod } from "@martly/shared/constants";

/** Positive amounts: Martly owes the store. Negative: the store owes Martly. */
export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: string | number;
  memo: string | null;
  state: LedgerEntryState;
  storeId: string | null;
  storeName: string | null;
  orderId: string | null;
  orderRef: string | null;
  returnRequestId: string | null;
  sourceType: string | null;
  availableAt: string | null;
  createdAt: string;
  settlementId: string | null;
  settlementNumber: string | null;
}

export interface PayoutAccount {
  accountHolder: string;
  accountLast4: string | null;
  ifsc: string | null;
  upiVpa: string | null;
  verified: boolean;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface LedgerSummary {
  available: number;
  onHold: number;
  codThisWeek: number;
  commission: { onlinePct: number; codPct: number };
  nextRunAt: string;
  isOwner: boolean;
  stores: { storeId: string; name: string; available: number; onHold: number }[];
  owner: {
    carried: number;
    nextPayout: { id: string; number: string; amount: number; status: SettlementStatus } | null;
    lastPayout: { id: string; number: string; amount: number; utr: string | null; paidAt: string } | null;
    due: { id: string; amount: number; createdAt: string } | null;
    payoutAccount: PayoutAccount | null;
  } | null;
}

export interface Settlement {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  credits: string | number;
  debits: string | number;
  carriedIn: string | number;
  net: string | number;
  status: SettlementStatus;
  payoutMethod: PayoutMethod | null;
  utr: string | null;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface SettlementDetail extends Settlement {
  stores: { storeId: string; name: string; total: number; lines: { type: LedgerEntryType; count: number; amount: number }[] }[];
  carriedFrom: { id: string; number: string; net: number; status: SettlementStatus }[];
  statementUrl: string;
}

export interface DuesCheckout {
  dueId: string;
  orderId: string;
  /** Paise */
  amount: number;
  currency: string;
  keyId: string;
}
