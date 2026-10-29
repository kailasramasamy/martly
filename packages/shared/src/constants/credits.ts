export const CreditGrantStatus = {
  ACTIVE: "ACTIVE",
  RESERVED: "RESERVED",
  USED: "USED",
  EXPIRED: "EXPIRED",
} as const;
export type CreditGrantStatus = (typeof CreditGrantStatus)[keyof typeof CreditGrantStatus];

/** Funder key on grants paid for by Martly; a store's grants carry the store id */
export const MARTLY_CREDIT_FUNDER = "MARTLY";

export const CREDIT_DEFAULTS = { amount: 50, minOrderAmount: 199, validDays: 14 } as const;

/** The most a store may give each new customer */
export const STORE_CREDIT_MAX_AMOUNT = 200;

/** Customers are reminded this many days before unused credit expires */
export const CREDIT_REMINDER_DAYS = 3;
