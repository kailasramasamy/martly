import { useState } from "react";
import { App } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { BuyImagesModal } from "../components/ai-images/buy-images-modal";
import { isAiImagesExhausted } from "../components/ai-images/exhausted";
import type { Entitlements } from "../pages/marketing/types";
import { useEntitlements } from "./use-entitlements";

export type AiImageUsageData = Entitlements["aiImages"];

/**
 * The organisation's AI image meter plus the Buy modal. The platform admin has no organisation and is never charged,
 * so `usage` stays null for them. Render `buyModal` once wherever the hook is used.
 */
export function useAiImages() {
  const { notification } = App.useApp();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const { entitlements, reload } = useEntitlements(!!identity && identity.role !== "SUPER_ADMIN");
  const [buying, setBuying] = useState(false);

  /** Handles a refused generation: returns true after telling the user and offering the packs */
  const handleExhausted = (err: unknown) => {
    if (!isAiImagesExhausted(err)) return false;
    notification.error({ message: err.response?.data.message });
    setBuying(true);
    void reload();
    return true;
  };

  return {
    usage: entitlements?.aiImages ?? null,
    refresh: reload,
    openBuy: () => setBuying(true),
    handleExhausted,
    buyModal: <BuyImagesModal open={buying} onClose={() => setBuying(false)} onPaid={reload} />,
  };
}

/** Whether the organisation can pay for `cost` images; always true when there is no meter */
export const canAfford = (usage: AiImageUsageData | null, cost: number) => !usage || usage.left >= cost;
