import { useCallback, useEffect, useState } from "react";
import { App, Button, Table } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../../providers/data-provider";
import { errorMessage } from "../utils";
import type { PayoutAccount } from "../types";

type PendingAccount = PayoutAccount & { organizationId: string; organizationName: string };

export function AccountsTab() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/ledger/platform/payout-accounts", { params: { pending: true } });
      setRows(res.data.data);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load payout accounts") });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => { void load(); }, [load]);

  const verify = async (organizationId: string) => {
    try {
      await axiosInstance.post(`/ledger/platform/payout-accounts/${organizationId}/verify`);
      notification.success({ message: "Payout account verified" });
      await load();
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not verify") });
    }
  };

  const columns = [
    { title: "Organization", dataIndex: "organizationName" },
    { title: "Account holder", dataIndex: "accountHolder" },
    { title: "Bank account", render: (_: unknown, r: PendingAccount) => (r.accountLast4 ? `••••${r.accountLast4} · ${r.ifsc ?? ""}` : "—") },
    { title: "UPI", dataIndex: "upiVpa", render: (v: string | null) => v ?? "—" },
    { title: "Updated", dataIndex: "updatedAt", render: (v: string) => dayjs(v).format("D MMM YYYY, h:mm A") },
    { title: "", render: (_: unknown, r: PendingAccount) => <Button type="primary" size="small" onClick={() => verify(r.organizationId)}>Verify</Button> },
  ];
  return <Table size="small" rowKey="organizationId" loading={loading} dataSource={rows} columns={columns} pagination={false} locale={{ emptyText: "Nothing is waiting for verification" }} />;
}
