import { useCallback, useEffect, useState } from "react";
import { Show } from "@refinedev/antd";
import { useNavigation, useParsed } from "@refinedev/core";
import { Spin } from "antd";
import type { PromoDetail } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { ManualSetup, PromoHeader } from "./promo-details";
import { PromoActions, useAction } from "./promo-actions";
import { DraftingProgress, PromoPreview } from "./promo-preview";
import { PromoBanner } from "./promo-banner";
import { PromoProducts } from "./promo-products";
import { ReadableSection } from "../../components/ReadableSection";

const POLL_MS = 2000;
const PREVIEW_STATUSES = ["READY", "LIVE", "ENDED"];

function usePromo(id: string | undefined) {
  const [promo, setPromo] = useState<PromoDetail | null>(null);
  const status = promo?.status;

  const load = useCallback(async () => {
    if (!id) return;
    const res = await axiosInstance.get(`/promos/${id}`);
    setPromo(res.data.data);
  }, [id]);

  useEffect(() => {
    setPromo(null);
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (status !== "DRAFTING") return;
    const interval = setInterval(() => load().catch(() => undefined), POLL_MS);
    return () => clearInterval(interval);
  }, [status, load]);

  return { promo, reload: load };
}

export const PromoShow = () => {
  const { id } = useParsed();
  const { list, show } = useNavigation();
  const { promo, reload } = usePromo(id ? String(id) : undefined);
  const { busy, run } = useAction(() => void reload());

  if (!promo) return <Spin style={{ display: "block", margin: "64px auto" }} />;

  const removeProduct = (productId: string) =>
    run(
      "remove",
      () => axiosInstance.patch(`/promos/${promo.id}/items`, { productIds: promo.products.map((p) => p.productId).filter((p) => p !== productId) }),
      "Product removed",
      "Could not remove the product",
    );

  return (
    <Show
      title={promo.title ?? promo.brief}
      canEdit={false}
      canDelete={false}
      headerButtons={() => (
        <PromoActions promo={promo} busy={busy} run={run} onDeleted={() => list("promos")} onRetried={(newId) => show("promos", newId)} />
      )}
    >
      <ReadableSection>
        <PromoHeader promo={promo} />
        {promo.kind === "MANUAL" && <ManualSetup promo={promo} />}
        {promo.status === "DRAFTING" && <DraftingProgress log={promo.log} />}
        {PREVIEW_STATUSES.includes(promo.status) && (
          <>
            {promo.kind === "AI" && <PromoPreview promo={promo} />}
            <PromoBanner promo={promo} onChanged={() => void reload()} />
            <PromoProducts promo={promo} busy={busy !== null} onRemove={removeProduct} />
          </>
        )}
      </ReadableSection>
    </Show>
  );
};
