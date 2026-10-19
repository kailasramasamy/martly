import { useCallback, useState } from "react";
import { AI_IMAGES_LOW_SHARE } from "@martly/shared/constants";
import { ApiError } from "../../../lib/api";
import { useToast } from "../../../lib/toast-context";
import type { AdProduct, AiImages } from "./plan-types";

/** The error name the API sends with a 402 when an AI-image action finds the meter empty */
const AI_IMAGES_EXHAUSTED = "AI_IMAGES_EXHAUSTED";

export type AiImageLevel = "ok" | "low" | "out";

/** out: not enough left for the action; low: 20% or less of the month's allowance remains */
export function aiImageLevel(ai: AiImages, cost: number): AiImageLevel {
  if (ai.left < cost) return "out";
  return ai.total > 0 && ai.left / ai.total <= AI_IMAGES_LOW_SHARE ? "low" : "ok";
}

export const imagePacks = (products: AdProduct[] | null) =>
  (products ?? []).filter((p) => p.kind === "AI_IMAGE_PACK").sort((a, b) => a.aiImageCredits - b.aiImageCredits);

/**
 * Catches the 402 AI_IMAGES_EXHAUSTED of an AI-image call: shows the server's message and opens the buy sheet instead of
 * failing. Other errors pass through; a caught call resolves to undefined.
 */
export function useAiImageGate() {
  const toast = useToast();
  const [buying, setBuying] = useState(false);
  const guard = useCallback(async <R,>(call: () => Promise<R>): Promise<R | undefined> => {
    try {
      return await call();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 402 || err.code !== AI_IMAGES_EXHAUSTED) throw err;
      toast.show(err.message, "error");
      setBuying(true);
      return undefined;
    }
  }, [toast]);
  return { buying, openBuy: () => setBuying(true), closeBuy: () => setBuying(false), guard };
}
