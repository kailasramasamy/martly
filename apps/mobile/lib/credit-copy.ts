import type { CreditGrantView, CreditOffer } from "@martly/shared/types";
import { useLanguage } from "./language-context";
import { useStrings } from "./i18n/use-strings";
import { formatDate } from "./i18n/format";

type Credit = CreditOffer | CreditGrantView;

const DAY_MS = 86_400_000;

export const rupees = (n: number) => String(Math.round(n));

/** Days until the credit expires, rounded up; 0 once it has run out */
export const daysLeft = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS));

export const expiryLabel = (expiresAt: string) => formatDate(expiresAt, { day: "numeric", month: "short" });

/** Credit wording in the shopper's language: the funder's own copy when set, otherwise worded from the amount */
export function useCreditCopy() {
  const { language } = useLanguage();
  const t = useStrings("credits");
  const own = (credit: Credit, field: "headline" | "message") => (language && credit.translations?.[language]?.[field]) || credit[field];

  return {
    /** "Martly Cash", or "{Store} Cash" for store credit */
    name: (credit: Credit) => (credit.storeName ? t.storeCash(credit.storeName) : t.martlyCash),
    headline: (credit: Credit) =>
      own(credit, "headline") ?? (credit.storeName ? t.storeHeadline(rupees(credit.amount), credit.storeName) : t.headline(rupees(credit.amount))),
    message: (offer: CreditOffer) =>
      own(offer, "message") ?? (offer.storeName
        ? t.storeMessage(rupees(offer.minOrderAmount), offer.validDays, offer.storeName)
        : t.message(rupees(offer.minOrderAmount), offer.validDays)),
  };
}
