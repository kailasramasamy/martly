/** Ledger entry types. Positive amounts mean Martly owes the store; negative that the store owes Martly. */
export const LedgerEntryType = {
  SALE_ONLINE: "SALE_ONLINE",
  SALE_WALLET: "SALE_WALLET",
  PLATFORM_COUPON: "PLATFORM_COUPON",
  PLATFORM_CREDIT: "PLATFORM_CREDIT",
  RETURN_REFUND: "RETURN_REFUND",
  DOOR_REFUND: "DOOR_REFUND",
  REFERRAL_REWARD: "REFERRAL_REWARD",
  GOODWILL_DEBIT: "GOODWILL_DEBIT",
  MEMBERSHIP_SALE: "MEMBERSHIP_SALE",
  PLAN_FEE: "PLAN_FEE",
  BALANCE_PAYMENT: "BALANCE_PAYMENT",
  REVERSAL: "REVERSAL",
  ADJUSTMENT: "ADJUSTMENT",
  SETTLEMENT_PAYOUT: "SETTLEMENT_PAYOUT",
  COMMISSION: "COMMISSION",
  COMMISSION_REFUND: "COMMISSION_REFUND",
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const LedgerEntryTypeLabels: Record<LedgerEntryType, string> = {
  SALE_ONLINE: "Online payment",
  SALE_WALLET: "Wallet payment",
  PLATFORM_COUPON: "Martly coupon",
  PLATFORM_CREDIT: "Martly welcome credit",
  RETURN_REFUND: "Return refund",
  DOOR_REFUND: "Door hand-back refund",
  REFERRAL_REWARD: "Referral rewards",
  GOODWILL_DEBIT: "Support credit",
  MEMBERSHIP_SALE: "Membership sale",
  PLAN_FEE: "Paid from balance",
  BALANCE_PAYMENT: "Balance payment",
  REVERSAL: "Reversal",
  ADJUSTMENT: "Adjustment by Martly",
  SETTLEMENT_PAYOUT: "Payout",
  COMMISSION: "Martly commission",
  COMMISSION_REFUND: "Commission refund",
};

/** Activity tabs: which entry types each one lists */
export const LedgerEntryGroup = {
  SALES: ["SALE_ONLINE", "SALE_WALLET", "PLATFORM_COUPON", "PLATFORM_CREDIT", "MEMBERSHIP_SALE"],
  REFUNDS: ["RETURN_REFUND", "DOOR_REFUND", "REFERRAL_REWARD", "GOODWILL_DEBIT", "REVERSAL"],
  FEES: ["COMMISSION", "COMMISSION_REFUND"],
  PAYOUTS: ["SETTLEMENT_PAYOUT", "PLAN_FEE", "BALANCE_PAYMENT", "ADJUSTMENT"],
} as const satisfies Record<string, readonly LedgerEntryType[]>;
export type LedgerEntryGroup = keyof typeof LedgerEntryGroup;

/** Where an entry is in its life: inside the return window, ready for the next payout, or settled */
export const LedgerEntryState = { ON_HOLD: "ON_HOLD", AVAILABLE: "AVAILABLE", SETTLED: "SETTLED" } as const;
export type LedgerEntryState = (typeof LedgerEntryState)[keyof typeof LedgerEntryState];

export const SettlementStatus = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  PAID: "PAID",
  FAILED: "FAILED",
  CARRIED_FORWARD: "CARRIED_FORWARD",
} as const;
export type SettlementStatus = (typeof SettlementStatus)[keyof typeof SettlementStatus];

export const SettlementStatusLabels: Record<SettlementStatus, string> = {
  DRAFT: "Awaiting bank details",
  APPROVED: "Scheduled",
  PAID: "Paid",
  FAILED: "Failed",
  CARRIED_FORWARD: "Carried forward",
};

export const PayoutMethod = { BANK_TRANSFER: "BANK_TRANSFER", UPI: "UPI" } as const;
export type PayoutMethod = (typeof PayoutMethod)[keyof typeof PayoutMethod];

export const BalanceDueStatus = { PENDING: "PENDING", PAID: "PAID", CANCELLED: "CANCELLED" } as const;
export type BalanceDueStatus = (typeof BalanceDueStatus)[keyof typeof BalanceDueStatus];

export const RefundDestination = { WALLET: "WALLET", CASH: "CASH" } as const;
export type RefundDestination = (typeof RefundDestination)[keyof typeof RefundDestination];

/** Settlement cycle: weekly, Monday 06:00 IST */
export const SETTLEMENT_WEEKDAY = 1;
export const SETTLEMENT_HOUR_IST = 6;
/** Smaller positive nets are carried into the next week */
export const SETTLEMENT_MIN_PAYOUT = 100;
/** A balance negative for this many weekly runs and above the threshold becomes a due to pay Martly */
export const BALANCE_DUE_WEEKS = 4;
export const BALANCE_DUE_THRESHOLD = 500;
/** Refund debits above this alert the store's finance staff */
export const LARGE_REFUND_ALERT = 1000;
/** Commission rates include GST at this rate; statements show the GST share for information */
export const COMMISSION_GST_PCT = 18;
