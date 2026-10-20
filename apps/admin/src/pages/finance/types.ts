export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  memo: string | null;
  state: string;
  storeId: string | null;
  storeName: string | null;
  orderId: string | null;
  orderRef: string | null;
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
  owner: null | {
    carried: number;
    nextPayout: { id: string; number: string; amount: number; status: string } | null;
    lastPayout: { id: string; number: string; amount: number; utr: string | null; paidAt: string } | null;
    due: { id: string; amount: number; createdAt: string } | null;
    payoutAccount: PayoutAccount | null;
  };
}

export interface Settlement {
  id: string;
  number: string;
  organizationId: string;
  organizationName: string;
  periodStart: string;
  periodEnd: string;
  credits: number;
  debits: number;
  carriedIn: number;
  net: number;
  status: string;
  payoutMethod: string | null;
  utr: string | null;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface SettlementDetail extends Settlement {
  stores: { storeId: string; name: string; total: number; lines: { type: string; count: number; amount: number }[] }[];
  carriedFrom: { id: string; number: string; net: number; status: string }[];
  statementUrl: string;
}
