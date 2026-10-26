import type { StorefrontCheckKey } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { ResolveContext } from "../../home/types.js";

export const STORE_SELECT = {
  id: true, name: true, organizationId: true, logoUrl: true, imageUrl: true, tagline: true, highlights: true,
  promoImages: true, freeDeliveryThreshold: true,
} as const;

export interface CheckContext {
  prisma: PrismaClient;
  store: {
    id: string; name: string; organizationId: string; logoUrl: string | null; imageUrl: string | null; tagline: string | null;
    highlights: string[]; promoImages: string[]; freeDeliveryThreshold: unknown;
  };
  now: Date;
  /** For the Home screen's own rules */
  resolve: ResolveContext;
}

export const flag = (key: StorefrontCheckKey, on: boolean): StorefrontCheckResult => ({ key, status: on ? "ON" : "OFF", earned: on ? 1 : 0 });

/** On at `need`, partly earned below it */
export function fromCount(key: StorefrontCheckKey, have: number, need: number): StorefrontCheckResult {
  const status = have >= need ? "ON" : have > 0 ? "PARTIAL" : "OFF";
  return { key, status, earned: Math.min(1, have / need), have, need };
}

export const notApplicable = (key: StorefrontCheckKey): StorefrontCheckResult => ({ key, status: "NA", earned: 0 });

/** Rows inside their start/end window */
export function liveWindow(now: Date, start: string, end: string) {
  return { AND: [{ OR: [{ [start]: null }, { [start]: { lte: now } }] }, { OR: [{ [end]: null }, { [end]: { gte: now } }] }] };
}
