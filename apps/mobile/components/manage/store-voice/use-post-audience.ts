import { useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";

type Audience = { count: number; scope: "AISLES" | "NEW" | "UNTAGGED" | "FEW_BUYERS"; aisleBuyers: number | null };

// Kind or tags settle this long before the count is asked for
const SETTLE_MS = 400;

/** How many shoppers the post would notify, and which ones, as the owner picks the kind and tags products */
export function usePostAudience(storeId: string, kind: string, productIds: string[]) {
  const [audience, setAudience] = useState<Audience | null>(null);
  const key = productIds.join(",");
  useEffect(() => {
    let live = true;
    setAudience(null);
    const timer = setTimeout(() => {
      api.post<Audience>("/api/v1/store-voice/audience", { storeId, kind, productIds: key ? key.split(",") : [] })
        .then((res) => live && setAudience(res.data))
        .catch((err) => {
          if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
        });
    }, SETTLE_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [storeId, kind, key]);
  return audience;
}

const plural = (n: number) => (n === 1 ? "1 shopper" : `${n} shoppers`);

/** Who gets the push and why, for under the Notify switch: the aisles' buyers, or everyone and the reason */
export function describeAudience(audience: Audience | null) {
  const cap = "One notification a day at most.";
  if (!audience) return `Counting shoppers… ${cap}`;
  const all = `all ${plural(audience.count)} who ordered here in the last 60 days`;
  const who = {
    AISLES: `${plural(audience.count)} who bought from these aisles lately will get this.`,
    NEW: `New arrivals go to ${all}.`,
    UNTAGGED: `No products tagged, so ${all} will get this.`,
    FEW_BUYERS: `Only ${plural(audience.aisleBuyers ?? 0)} bought from these aisles lately, so ${all} will get this.`,
  }[audience.scope];
  return `${who} ${cap}`;
}
