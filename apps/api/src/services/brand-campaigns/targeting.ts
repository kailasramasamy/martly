import type { Prisma } from "../../../generated/prisma/client.js";

/** Where a brand campaign runs: no targets means every store; otherwise stores matching any store, state or district */
export interface CampaignTargets {
  targetStoreIds: string[];
  targetStates: string[];
  targetDistricts: string[];
}

/** A district target, unique across states ("Tamil Nadu:Dharmapuri") */
export const districtKey = (state: string, district: string) => `${state}:${district}`;

const untargeted = (t: CampaignTargets) => !t.targetStoreIds.length && !t.targetStates.length && !t.targetDistricts.length;

/** Banners or campaigns aimed at this store: untargeted, or naming the store, its state or its district */
export function aimedAtStore(store: { id: string; state: string | null; district: string | null }) {
  return {
    OR: [
      { targetStoreIds: { isEmpty: true }, targetStates: { isEmpty: true }, targetDistricts: { isEmpty: true } },
      { targetStoreIds: { has: store.id } },
      ...(store.state ? [{ targetStates: { has: store.state } }] : []),
      ...(store.state && store.district ? [{ targetDistricts: { has: districtKey(store.state, store.district) } }] : []),
    ],
  };
}

/** The stores a campaign reaches */
export function storesTargeted(t: CampaignTargets): Prisma.StoreWhereInput {
  if (untargeted(t)) return {};
  return {
    OR: [
      { id: { in: t.targetStoreIds } },
      { state: { in: t.targetStates } },
      ...t.targetDistricts.map((key) => {
        const [state, district] = key.split(":");
        return { state, district };
      }),
    ],
  };
}
