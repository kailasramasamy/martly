import { useCallback, useEffect, useState } from "react";
import { Show } from "@refinedev/antd";
import { useNavigation, useParsed } from "@refinedev/core";
import { Spin, Tag, Typography } from "antd";
import type { PromoDetail } from "@martly/shared/types";
import { PROMO_STATUS_CONFIG } from "../../constants/tag-colors";
import { axiosInstance } from "../../providers/data-provider";
import { PromoActions, useAction } from "./promo-actions";
import { DraftingProgress, PromoPreview } from "./promo-preview";
import { PromoProducts } from "./promo-products";

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
        <PromoActions promo={promo} busy={busy} run={run} onDiscarded={() => list("promos")} onRetried={(newId) => show("promos", newId)} />
      )}
    >
      <Tag color={PROMO_STATUS_CONFIG[promo.status]?.color} style={{ marginBottom: 8 }}>{PROMO_STATUS_CONFIG[promo.status]?.label}</Tag>
      <Typography.Paragraph type="secondary">{promo.brief}</Typography.Paragraph>
      {promo.status === "DRAFTING" && <DraftingProgress log={promo.log} />}
      {PREVIEW_STATUSES.includes(promo.status) && (
        <>
          <PromoPreview promo={promo} />
          <PromoProducts promo={promo} busy={busy !== null} onRemove={removeProduct} />
        </>
      )}
    </Show>
  );
};
