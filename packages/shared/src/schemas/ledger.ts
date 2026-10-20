import { z } from "zod";
import { LedgerEntryGroup, LedgerEntryState, LedgerEntryType, SettlementStatus } from "../constants/ledger.js";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
  /** Super admin only: which organization to look at */
  organizationId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  group: z.enum(Object.keys(LedgerEntryGroup) as [keyof typeof LedgerEntryGroup]).optional(),
  type: z.nativeEnum(LedgerEntryType).optional(),
  state: z.nativeEnum(LedgerEntryState).optional(),
  settlementId: z.string().uuid().optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
  q: z.string().max(100).optional(),
});
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

export const settlementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  organizationId: z.string().uuid().optional(),
  status: z.nativeEnum(SettlementStatus).optional(),
  /** Settlements whose period overlaps this range */
  from: dateKey.optional(),
  to: dateKey.optional(),
  /** Settlement number or UTR */
  q: z.string().max(100).optional(),
});
export type SettlementQuery = z.infer<typeof settlementQuerySchema>;

export const ledgerAdjustmentSchema = z.object({
  organizationId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  amount: z.number().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, "Amount must be non-zero and at most ₹10,00,000"),
  reason: z.string().trim().min(5, "Give a reason the owner will understand").max(300),
});
export type LedgerAdjustmentInput = z.infer<typeof ledgerAdjustmentSchema>;

export const payoutAccountSchema = z.object({
  accountHolder: z.string().trim().min(2).max(120),
  accountNumber: z.string().regex(/^\d{9,18}$/, "Account number is 9 to 18 digits").optional(),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC").optional(),
  upiVpa: z.string().trim().regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID").optional(),
}).refine((a) => !a.accountNumber || a.ifsc, { message: "A new account number needs its IFSC", path: ["ifsc"] });
export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

export const ledgerQueryMessageSchema = z.object({ message: z.string().trim().min(5, "Tell us what looks wrong").max(1000) });

export const settlementIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

export const markSettlementsPaidSchema = settlementIdsSchema.extend({
  method: z.enum(["BANK_TRANSFER", "UPI"]),
  utr: z.string().trim().min(6).max(40),
});
export type MarkSettlementsPaidInput = z.infer<typeof markSettlementsPaidSchema>;

export const markSettlementFailedSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const balanceDueOfflineSchema = z.object({ reference: z.string().trim().min(4).max(60) });

export const balanceDueVerifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});
