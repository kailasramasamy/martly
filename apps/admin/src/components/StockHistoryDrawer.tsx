import { useEffect, useState } from "react";
import { Drawer, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { StockMovementTypeLabels } from "@martly/shared/constants";
import type { StockMovementType } from "@martly/shared/constants";

import { axiosInstance } from "../providers/data-provider";

interface Movement {
  id: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  createdAt: string;
  user: { name: string } | null;
}

interface Props {
  storeProductId: string | null;
  title?: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

export const StockHistoryDrawer = ({ storeProductId, title, onClose }: Props) => {
  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [storeProductId]);

  useEffect(() => {
    if (!storeProductId) return;
    setLoading(true);
    axiosInstance
      .get("/stock/movements", { params: { storeProductId, page, pageSize: PAGE_SIZE } })
      .then((res) => {
        setRows(res.data.data);
        setTotal(res.data.meta?.total ?? 0);
      })
      .catch((err: any) => message.error(err?.response?.data?.message ?? "Failed to load history"))
      .finally(() => setLoading(false));
  }, [storeProductId, page]);

  return (
    <Drawer title={title ? `Stock history — ${title}` : "Stock history"} open={!!storeProductId} onClose={onClose} width={640}>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, onChange: setPage, showSizeChanger: false }}
        columns={[
          { title: "When", dataIndex: "createdAt", render: (v: string) => dayjs(v).format("DD MMM, HH:mm") },
          { title: "Type", dataIndex: "type", render: (t: StockMovementType) => <Tag>{StockMovementTypeLabels[t] ?? t}</Tag> },
          {
            title: "Change",
            dataIndex: "quantity",
            align: "right" as const,
            render: (q: number) => <span style={{ color: q < 0 ? "#ef4444" : "#16a34a" }}>{q > 0 ? `+${q}` : q}</span>,
          },
          { title: "Stock", align: "right" as const, render: (_: unknown, m: Movement) => `${m.stockBefore} → ${m.stockAfter}` },
          { title: "By", dataIndex: ["user", "name"], render: (v?: string) => v ?? "—" },
          { title: "Note", dataIndex: "note", render: (v: string | null) => v ?? "—" },
        ]}
      />
    </Drawer>
  );
};
