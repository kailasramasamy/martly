import type { CreditCampaignRow } from "@martly/shared/types";
import { TONES, type Tone } from "../marketing/common";

export type CampaignState = "active" | "paused" | "ended";

export function campaignState(c: CreditCampaignRow): CampaignState {
  if (c.endsAt && new Date(c.endsAt).getTime() < Date.now()) return "ended";
  return c.isActive ? "active" : "paused";
}

export const STATE_TONE: Record<CampaignState, Tone> = {
  active: { label: "Active", ...TONES.green },
  paused: { label: "Paused", ...TONES.amber },
  ended: { label: "Ended", ...TONES.slate },
};

/** Running campaigns first, then paused, then ended; newest first within each */
const STATE_ORDER: Record<CampaignState, number> = { active: 0, paused: 1, ended: 2 };
const byState = (a: CreditCampaignRow, b: CreditCampaignRow) =>
  STATE_ORDER[campaignState(a)] - STATE_ORDER[campaignState(b)] || b.createdAt.localeCompare(a.createdAt);

/** Martly's campaigns and the stores' own, kept apart because who pays differs */
export function splitByFunder(rows: CreditCampaignRow[]) {
  return {
    martly: rows.filter((c) => c.storeId === null).sort(byState),
    stores: rows.filter((c) => c.storeId !== null).sort(byState),
  };
}

/** Totals across campaigns: customers who used the credit, what it cost, and credit given but not used yet */
export function creditTotals(rows: CreditCampaignRow[]) {
  return rows.reduce(
    (t, c) => ({ won: t.won + c.usage.usedCount, spent: t.spent + c.usage.spent, outstanding: t.outstanding + c.usage.outstanding }),
    { won: 0, spent: 0, outstanding: 0 },
  );
}
