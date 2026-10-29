import { LedgerEntryType, SettlementStatus } from "@martly/shared/constants";
import type { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/theme";
import { formatINR } from "../ui/tokens";
import type { LedgerEntry, PayoutAccount } from "../../../lib/ledger-types";

/** "+₹1,234" / "−₹120": credits to the store are positive */
export function signedINR(value: string | number, opts: { decimals?: boolean } = {}): string {
  const n = Number(value);
  if (n === 0) return formatINR(0, opts);
  return `${n > 0 ? "+" : "−"}${formatINR(Math.abs(n), opts)}`;
}

export const amountColor = (value: string | number) => (Number(value) < 0 ? colors.error : Number(value) > 0 ? "#15803d" : colors.text);

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** "Monday, 20 Oct" for the next settlement run */
export const runDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

const ENTRY_ICONS: Record<LedgerEntryType, keyof typeof Ionicons.glyphMap> = {
  SALE_ONLINE: "card-outline",
  SALE_WALLET: "wallet-outline",
  PLATFORM_COUPON: "ticket-outline",
  PLATFORM_CREDIT: "gift-outline",
  RETURN_REFUND: "return-down-back-outline",
  DOOR_REFUND: "hand-left-outline",
  REFERRAL_REWARD: "gift-outline",
  GOODWILL_DEBIT: "heart-outline",
  MEMBERSHIP_SALE: "diamond-outline",
  COMMISSION: "pricetag-outline",
  COMMISSION_REFUND: "arrow-undo-outline",
  PLAN_FEE: "rocket-outline",
  BALANCE_PAYMENT: "swap-horizontal-outline",
  REVERSAL: "refresh-outline",
  ADJUSTMENT: "create-outline",
  SETTLEMENT_PAYOUT: "arrow-up-circle-outline",
};

export const entryIcon = (type: LedgerEntryType) => ENTRY_ICONS[type];

/** Where an entry stands: inside the return window, ready for the next payout, or paid out */
export function entryPill(e: Pick<LedgerEntry, "state" | "availableAt" | "settlementNumber">): { label: string; color: string; bg: string } {
  if (e.state === "SETTLED") return { label: e.settlementNumber ? `Settled ${e.settlementNumber}` : "Settled", color: "#475569", bg: "#f1f5f9" };
  if (e.state === "ON_HOLD") return { label: e.availableAt ? `On hold · available ${shortDate(e.availableAt)}` : "On hold", color: "#b45309", bg: "#fef3c7" };
  return { label: "Available", color: "#15803d", bg: "#dcfce7" };
}

export const SETTLEMENT_PILL: Record<SettlementStatus, { color: string; bg: string }> = {
  DRAFT: { color: "#b45309", bg: "#fef3c7" },
  APPROVED: { color: "#1d4ed8", bg: "#dbeafe" },
  PAID: { color: "#15803d", bg: "#dcfce7" },
  FAILED: { color: "#b91c1c", bg: "#fee2e2" },
  CARRIED_FORWARD: { color: "#475569", bg: "#f1f5f9" },
};

/** Bank accounts show their last four digits; UPI shows the handle */
export function accountLine(a: PayoutAccount): string {
  if (a.accountLast4) return `${a.accountHolder} · A/c ••••${a.accountLast4}${a.ifsc ? ` · ${a.ifsc}` : ""}`;
  return `${a.accountHolder} · ${a.upiVpa ?? ""}`;
}
