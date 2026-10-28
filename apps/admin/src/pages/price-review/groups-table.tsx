import { useEffect, useState, type ReactNode } from "react";
import { Avatar, Button, Popconfirm, Progress, Segmented, Space, Table, Typography } from "antd";
import type { PriceReviewGroup } from "@martly/shared/types";
import { UNBRANDED } from "@martly/shared/schemas";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { useApiList, type PriceReviewActions } from "./api";
import { PercentOffPopover } from "./percent-off";

export type GroupBy = "brand" | "subcategory";

interface Props {
  by: GroupBy;
  storeId: string | undefined;
  departmentId: string | undefined;
  version: number;
  actions: PriceReviewActions;
  canHide: boolean;
  emptyText: ReactNode;
  onReview: (group: PriceReviewGroup) => void;
}

const PAGE_SIZE = 30;

/** Brands or aisles to settle in one go; Review drops into the product table filtered to the group */
export const GroupsTable = ({ by, storeId, departmentId, version, actions, canHide, emptyText, onReview }: Props) => {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = storeId ? { storeId, by, status, departmentId, q: q || undefined, page, pageSize: PAGE_SIZE } : null;
  const { rows, meta, loading } = useApiList<PriceReviewGroup>("groups", params, version);

  useEffect(() => setPage(1), [storeId, by, status, departmentId, q]);

  const scope = (g: PriceReviewGroup) => (by === "brand" ? { brandId: g.id } : { subcategoryId: g.id });
  const noun = by === "brand" ? "brand" : "aisle";

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented options={[{ label: "Pending", value: "pending" }, { label: "All", value: "all" }]} value={status} onChange={(v) => setStatus(v as "pending" | "all")} />
        <DebouncedSearch placeholder={`Search ${noun}s`} onSearch={setQ} style={{ width: 280 }} />
      </Space>
      <Table<PriceReviewGroup>
        rowKey="id"
        size="small"
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: storeId ? emptyText : "Pick a store to review its prices" }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: meta?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        columns={[
          {
            title: by === "brand" ? "Brand" : "Aisle",
            render: (_, g) => (
              <Space>
                <Avatar shape="square" src={g.imageUrl && <img src={g.imageUrl} alt="" style={{ objectFit: "contain" }} />}>{g.name[0]}</Avatar>
                <Typography.Text strong>{g.id === UNBRANDED ? "Unbranded" : g.name}</Typography.Text>
              </Space>
            ),
          },
          {
            title: "Progress",
            width: 220,
            render: (_, g) => <Progress size="small" percent={g.total ? Math.round(((g.total - g.pending) / g.total) * 100) : 100} />,
          },
          { title: "Typical", width: 160, render: (_, g) => (g.typicalOffPct === null ? "-" : `${g.typicalOffPct}% off MRP`) },
          { title: "Pending", dataIndex: "pending", width: 90, align: "right" },
          {
            title: "Actions",
            render: (_, g) => (
              <Space size={4} wrap>
                <Button size="small" onClick={() => onReview(g)}>Review</Button>
                <Popconfirm title={`Mark ${g.pending} pending prices as checked?`} disabled={g.pending === 0} onConfirm={() => actions.bulk({ action: "confirm", scope: scope(g) })}>
                  <Button size="small" type="primary" disabled={g.pending === 0}>Prices OK</Button>
                </Popconfirm>
                <PercentOffPopover onApply={(percent) => actions.bulk({ action: "percentOffMrp", percent, scope: scope(g) })}>
                  <Button size="small" disabled={g.pending === 0}>Set % off MRP</Button>
                </PercentOffPopover>
                {canHide && (
                  <Popconfirm title={`Not stocked? Hide ${g.pending} pending listings.`} okButtonProps={{ danger: true }} disabled={g.pending === 0} onConfirm={() => actions.bulk({ action: "hide", scope: scope(g) })}>
                    <Button size="small" danger disabled={g.pending === 0}>Not stocked</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
    </>
  );
};
