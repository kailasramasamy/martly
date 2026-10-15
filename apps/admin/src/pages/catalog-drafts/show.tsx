import { useCallback, useEffect, useState } from "react";
import { Show } from "@refinedev/antd";
import { useNavigation, useParsed } from "@refinedev/core";
import { Alert, Button, Popconfirm, Space, Spin, Tag } from "antd";
import type { ApproveCatalogDraftInput } from "@martly/shared/schemas";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { CATALOG_DRAFT_STATUS_CONFIG } from "../../constants/tag-colors";
import { axiosInstance } from "../../providers/data-provider";
import { useAction } from "../promos/promo-actions";
import { ApproveForm } from "./approve-form";
import { DraftFacts } from "./draft-facts";
import { ShotsGrid } from "./shots-grid";

const POLL_MS = 3000;
const IN_FLIGHT = ["QUEUED", "PROCESSING"];

function useDraft(id: string | undefined) {
  const [draft, setDraft] = useState<CatalogDraftDetail | null>(null);
  const status = draft?.status;

  const load = useCallback(async () => {
    if (!id) return;
    const res = await axiosInstance.get(`/catalog-drafts/${id}`);
    setDraft(res.data.data);
  }, [id]);

  useEffect(() => {
    setDraft(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!status || !IN_FLIGHT.includes(status)) return;
    const interval = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(interval);
  }, [status, load]);

  return { draft, reload: load };
}

function Banner({ draft }: { draft: CatalogDraftDetail }) {
  if (draft.error) return <Alert type="error" showIcon message={draft.error} />;
  if (draft.reviewReasons.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      message="Held for review"
      description={<ul style={{ margin: 0, paddingLeft: 20 }}>{draft.reviewReasons.map((r) => <li key={r}>{r}</li>)}</ul>}
    />
  );
}

export const CatalogDraftShow = () => {
  const { id } = useParsed();
  const { show } = useNavigation();
  const { draft, reload } = useDraft(id ? String(id) : undefined);
  const { busy, run } = useAction(() => void reload());

  if (!draft) return <Spin style={{ display: "block", margin: "64px auto" }} />;

  const act = (key: string, path: string, success: string, body?: ApproveCatalogDraftInput) =>
    run(key, () => axiosInstance.post(`/catalog-drafts/${draft.id}/${path}`, body), success, `Could not ${key}`);

  const discard = (
    <Popconfirm title="Discard this draft?" okText="Discard" okButtonProps={{ danger: true }} onConfirm={() => act("discard", "discard", "Draft discarded")}>
      <Button danger loading={busy === "discard"}>Discard</Button>
    </Popconfirm>
  );
  const status = CATALOG_DRAFT_STATUS_CONFIG[draft.status];
  const { productId } = draft;

  return (
    <Show title={draft.name ?? "Reading label…"} canEdit={false} canDelete={false} headerButtons={() => <Tag color={status?.color}>{status?.label ?? draft.status}</Tag>}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Banner draft={draft} />
        {draft.status === "NEEDS_REVIEW" && <ApproveForm draft={draft} busy={busy} discard={discard} onApprove={(body) => act("approve", "approve", "Product published", body)} />}
        {draft.status === "FAILED" && (
          <Space>
            <Button type="primary" loading={busy === "retry"} onClick={() => act("retry", "retry", "Retry queued")}>Retry</Button>
            {discard}
          </Space>
        )}
        {draft.status === "QUEUED" && discard}
        {productId && <Button type="link" onClick={() => show("products", productId)}>View product</Button>}
        <ShotsGrid shots={draft.shots} />
        <DraftFacts draft={draft} />
      </Space>
    </Show>
  );
};
