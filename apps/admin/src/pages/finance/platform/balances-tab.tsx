import { useEffect, useState } from "react";
import { App, Table, Tag } from "antd";
import { axiosInstance } from "../../../providers/data-provider";
import { errorMessage, formatRupees } from "../utils";

interface Balance {
  organizationId: string;
  name: string;
  available: number;
  onHold: number;
  carried: number;
  balance: number;
  scheduled: number;
  due: number;
  payoutAccount: "VERIFIED" | "PENDING" | "MISSING";
}

const ACCOUNT_TAG: Record<Balance["payoutAccount"], { color: string; label: string }> = {
  VERIFIED: { color: "green", label: "Verified" },
  PENDING: { color: "gold", label: "Awaiting verification" },
  MISSING: { color: "red", label: "Missing" },
};

const money = (key: keyof Balance) => ({
  dataIndex: key,
  align: "right" as const,
  sorter: (a: Balance, b: Balance) => Number(a[key]) - Number(b[key]),
  render: (v: number) => formatRupees(Number(v)),
});

const columns = [
  { title: "Organization", dataIndex: "name", sorter: (a: Balance, b: Balance) => a.name.localeCompare(b.name) },
  { title: "Available", ...money("available") },
  { title: "On hold", ...money("onHold") },
  { title: "Carried", ...money("carried") },
  { title: "Balance", ...money("balance") },
  { title: "Scheduled", ...money("scheduled") },
  { title: "Due", ...money("due") },
  {
    title: "Payout account",
    dataIndex: "payoutAccount",
    render: (v: Balance["payoutAccount"]) => <Tag color={ACCOUNT_TAG[v].color}>{ACCOUNT_TAG[v].label}</Tag>,
  },
];

export function BalancesTab() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/ledger/platform/balances")
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load balances") }))
      .finally(() => setLoading(false));
  }, [notification]);

  return <Table size="small" rowKey="organizationId" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 25 }} scroll={{ x: 900 }} />;
}
