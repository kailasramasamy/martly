import { useEffect, useState } from "react";
import type { PostAudience as Audience } from "@martly/shared/store-voice";
import { api, ApiError } from "../../../lib/api";

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
