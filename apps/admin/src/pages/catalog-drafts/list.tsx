import { useCallback, useEffect, useState } from "react";
import { List } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Image, Select, Space, Table, Tag, Typography, theme } from "antd";
import type { TablePaginationConfig } from "antd";
import dayjs from "dayjs";
import type { CatalogDraftSummary } from "@martly/shared/types";
import { CATALOG_DRAFT_STATUS_CONFIG } from "../../constants/tag-colors";
import { axiosInstance } from "../../providers/data-provider";

const { Text } = Typography;
const POLL_MS = 5000;
const THUMB = 56;
const IN_FLIGHT = ["QUEUED", "PROCESSING"];
const STATUS_OPTIONS = Object.entries(CATALOG_DRAFT_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

interface StoreOption {
  id: string;
  name: string;
}

function useDrafts(page: number, pageSize: number, status?: string, storeId?: string) {
  const [rows, setRows] = useState<CatalogDraftSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await axiosInstance.get("/catalog-drafts", { params: { page, pageSize, status, storeId } }).finally(() => setLoading(false));
    setRows(res.data.data);
    setTotal(res.data.meta.total);
  }, [page, pageSize, status, storeId]);

  const polling = rows.some((r) => IN_FLIGHT.includes(r.status));

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(interval);
  }, [polling, load]);

  return { rows, total, loading };
}

function useStoreOptions() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  useEffect(() => {
    void axiosInstance.get("/stores", { params: { pageSize: 200 } }).then((res) => setStores(res.data.data));
  }, []);
  return stores.map((s) => ({ value: s.id, label: s.name }));
}

function DraftName({ draft }: { draft: CatalogDraftSummary }) {
  if (!draft.name && IN_FLIGHT.includes(draft.status)) return <Text type="secondary">Reading label…</Text>;
  return (
    <Space direction="vertical" size={0}>
      <Text strong>{draft.name ?? "Untitled"}</Text>
      {draft.variantName && <Text type="secondary">{draft.variantName}</Text>}
    </Space>
  );
}

function DraftIssue({ draft }: { draft: CatalogDraftSummary }) {
  const text = draft.error ?? draft.reviewReasons[0];
  if (!text) return <Text type="secondary">—</Text>;
  return <Text type={draft.error ? "danger" : "warning"}>{text}</Text>;
}

function DraftTable({ rows, loading, pagination }: { rows: CatalogDraftSummary[]; loading: boolean; pagination: TablePaginationConfig }) {
  const { token } = theme.useToken();
  const { show } = useNavigation();
  return (
    <Table<CatalogDraftSummary>
      dataSource={rows}
      loading={loading}
      rowKey="id"
      scroll={{ x: "max-content" }}
      pagination={pagination}
      onRow={(record) => ({ onClick: () => show("catalog-drafts", record.id), style: { cursor: "pointer" } })}
    >
      <Table.Column<CatalogDraftSummary>
        title="Photo"
        width={THUMB + 32}
        render={(_, r) => <Image src={r.thumbnailUrl} width={THUMB} height={THUMB} preview={false} style={{ objectFit: "cover", borderRadius: token.borderRadius }} />}
      />
      <Table.Column<CatalogDraftSummary> title="Product" render={(_, r) => <DraftName draft={r} />} />
      <Table.Column<CatalogDraftSummary> title="Store" dataIndex="storeName" />
      <Table.Column<CatalogDraftSummary>
        title="Status"
        dataIndex="status"
        render={(s: string) => <Tag color={CATALOG_DRAFT_STATUS_CONFIG[s]?.color}>{CATALOG_DRAFT_STATUS_CONFIG[s]?.label ?? s}</Tag>}
      />
      <Table.Column<CatalogDraftSummary> title="Note" render={(_, r) => <DraftIssue draft={r} />} />
      <Table.Column<CatalogDraftSummary>
        title="Price / MRP"
        render={(_, r) => `₹${r.sellingPrice.toLocaleString("en-IN")} / ₹${r.mrp.toLocaleString("en-IN")}`}
      />
      <Table.Column<CatalogDraftSummary> title="Created by" dataIndex="createdByName" />
      <Table.Column<CatalogDraftSummary> title="AI cost" dataIndex="costUsd" render={(v: number) => `$${v.toFixed(3)}`} />
      <Table.Column<CatalogDraftSummary> title="Created" dataIndex="createdAt" render={(v: string) => dayjs(v).format("D MMM, h:mm A")} />
    </Table>
  );
}

export const CatalogDraftList = () => {
  const { token } = theme.useToken();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState<string>();
  const [storeId, setStoreId] = useState<string>();
  const storeOptions = useStoreOptions();
  const { rows, total, loading } = useDrafts(page, pageSize, status, storeId);

  const filter = (setter: (v: string | undefined) => void) => (value?: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <List title="Catalog agent" breadcrumb={false}>
      <Space style={{ marginBottom: token.marginMD }} wrap>
        <Select allowClear placeholder="Status" style={{ width: 180 }} options={STATUS_OPTIONS} value={status} onChange={filter(setStatus)} />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Store"
          style={{ width: 240 }}
          options={storeOptions}
          value={storeId}
          onChange={filter(setStoreId)}
        />
      </Space>
      <DraftTable
        rows={rows}
        loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
    </List>
  );
};
