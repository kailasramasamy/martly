import type { CreditCampaignRow, CreditTranslations } from "@martly/shared/types";
import { CREDIT_DEFAULTS, STORE_CREDIT_MAX_AMOUNT } from "@martly/shared/constants";
import { endOfDayIso, isoToDateKey, numberText, parseNumber } from "../marketing/common";

export interface CreditFormState {
  amount: string;
  minOrderAmount: string;
  validDays: string;
  budget: string;
  headline: string;
  message: string;
  taHeadline: string;
  taMessage: string;
  isActive: boolean;
  endsAt: string | null;
}

export type CreditFormErrors = Partial<Record<keyof CreditFormState, string>>;

export const EMPTY_CREDIT_FORM: CreditFormState = {
  amount: String(CREDIT_DEFAULTS.amount),
  minOrderAmount: String(CREDIT_DEFAULTS.minOrderAmount),
  validDays: String(CREDIT_DEFAULTS.validDays),
  budget: "",
  headline: "", message: "", taHeadline: "", taMessage: "",
  isActive: true,
  endsAt: null,
};

export const creditFormFrom = (c: CreditCampaignRow): CreditFormState => ({
  amount: numberText(c.amount),
  minOrderAmount: numberText(c.minOrderAmount),
  validDays: numberText(c.validDays),
  budget: numberText(c.budget),
  headline: c.headline ?? "",
  message: c.message ?? "",
  taHeadline: c.translations?.ta?.headline ?? "",
  taMessage: c.translations?.ta?.message ?? "",
  isActive: c.isActive,
  endsAt: isoToDateKey(c.endsAt),
});

/** Stores are capped per customer; Martly-funded credit (super admin) is not */
export function validateCreditForm(f: CreditFormState, capped: boolean): CreditFormErrors {
  const errors: CreditFormErrors = {};
  const amount = parseNumber(f.amount);
  const min = parseNumber(f.minOrderAmount);
  const days = parseNumber(f.validDays);
  const budget = parseNumber(f.budget);
  if (!amount || amount <= 0) errors.amount = "Enter an amount above 0";
  else if (capped && amount > STORE_CREDIT_MAX_AMOUNT) errors.amount = `A store can give up to ₹${STORE_CREDIT_MAX_AMOUNT}`;
  if (min === null || (amount && min < amount)) errors.minOrderAmount = "Minimum order must be at least the credit amount";
  if (!days || !Number.isInteger(days) || days < 1 || days > 90) errors.validDays = "Enter whole days between 1 and 90";
  if (!budget || budget <= 0) errors.budget = "Enter a budget above 0";
  if (f.endsAt && f.endsAt < new Date().toISOString().slice(0, 10)) errors.endsAt = "Must be today or later";
  return errors;
}

function translationsOf(f: CreditFormState, existing: CreditTranslations | null | undefined): CreditTranslations | null {
  const ta = { headline: f.taHeadline.trim() || undefined, message: f.taMessage.trim() || undefined };
  const { ta: _replaced, ...others } = existing ?? {};
  const next = ta.headline || ta.message ? { ...others, ta } : others;
  return Object.keys(next).length > 0 ? next : null;
}

export function creditPayload(f: CreditFormState, existing: CreditTranslations | null | undefined) {
  return {
    amount: parseNumber(f.amount) ?? 0,
    minOrderAmount: parseNumber(f.minOrderAmount) ?? 0,
    validDays: parseNumber(f.validDays) ?? 0,
    budget: parseNumber(f.budget) ?? 0,
    headline: f.headline.trim() || null,
    message: f.message.trim() || null,
    translations: translationsOf(f, existing),
    isActive: f.isActive,
    endsAt: f.endsAt ? endOfDayIso(f.endsAt) : null,
  };
}
