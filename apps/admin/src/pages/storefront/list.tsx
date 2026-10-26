import { useEffect, useState } from "react";
import { List } from "@refinedev/antd";
import { Button, Progress, Table, Typography, message } from "antd";
import { useNavigate } from "react-router";
import type { StorefrontStoreRow } from "@martly/shared/types";

import { axiosInstance } from "../../providers/data-provider";
import { GroupBars, scoreColor } from "./score";

const WeekChange = ({ value }: { value: number | null }) =>
  value == null ? <span>—</span> : <Typography.Text style={{ color: value >= 0 ? "#16a34a" : "#ef4444" }}>{value >= 0 ? `+${value}` : value}</Typography.Text>;

/** Every store's storefront score, weakest first */
export const StorefrontList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<StorefrontStoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/storefront/stores")
      .then((res) => setRows(res.data.data))
      .catch((err) => message.error(err.response?.data?.message ?? "Couldn't load stores"))
      .finally(() => setLoading(false));
  }, []);

  const open = (r: StorefrontStoreRow) => navigate(`/storefront/show/${r.storeId}`);

  return (
    <List title="Storefront health">
      <Table<StorefrontStoreRow>
        rowKey="storeId"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        onRow={(r) => ({ onClick: () => open(r), style: { cursor: "pointer" } })}
      >
        <Table.Column<StorefrontStoreRow> title="Store" render={(_, r) => (
          <div>
            <div style={{ fontWeight: 500 }}>{r.storeName}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.organizationName}</Typography.Text>
          </div>
        )} />
        <Table.Column<StorefrontStoreRow> title="Score" width={160} sorter={(a, b) => a.score - b.score} render={(_, r) => (
          <Progress percent={r.score} size="small" strokeColor={scoreColor(r.score)} format={(p) => <b style={{ color: scoreColor(r.score) }}>{p}</b>} />
        )} />
        <Table.Column<StorefrontStoreRow> title="Areas" render={(_, r) => <GroupBars groups={r.groups} width={120} />} />
        <Table.Column<StorefrontStoreRow> title="This week" width={110} render={(_, r) => <WeekChange value={r.weekChange} />} />
        <Table.Column<StorefrontStoreRow> title="" width={90} render={(_, r) => (
          <Button size="small" onClick={(e) => { e.stopPropagation(); open(r); }}>View</Button>
        )} />
      </Table>
    </List>
  );
};
