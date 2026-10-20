import { useCallback, useEffect, useState } from "react";
import { App, Button, Select, Space, Table } from "antd";
import { CheckOutlined, DownloadOutlined, DollarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { axiosInstance } from "../../../providers/data-provider";
import { SettlementStatusTag } from "../settlement-status";
import { errorMessage, formatRupees, saveBlob } from "../utils";
import type { Settlement } from "../types";
import { MarkFailedModal, MarkPaidModal } from "./queue-modals";

type QueueRow = Settlement & { payoutAccount: { verified: boolean; accountLast4: string | null; upiVpa: string | null } | null };

const STATUS_OPTIONS = [{ value: "APPROVED", label: "Scheduled" }, { value: "DRAFT", label: "Awaiting bank details" }];

function useQueue() {
  const { notification } = App.useApp();
  const [status, setStatus] = useState("APPROVED");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/ledger/platform/settlements", { params: { status } });
      setRows(res.data.data);
      setSelected([]);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load the payout queue") });
    } finally {
      setLoading(false);
    }
  }, [status, notification]);

  useEffect(() => { void load(); }, [load]);

  const run = async (call: () => Promise<unknown>, done: string) => {
    try {
      await call();
      notification.success({ message: done });
      await load();
    } catch (err) {
      notification.error({ message: errorMessage(err, "That didn't go through") });
    }
  };
  return { status, setStatus, rows, selected, setSelected, loading, run, notification };
}

const postSettlements = (url: string, body: object) => axiosInstance.post(`/ledger/platform/settlements${url}`, body);

const accountLabel = (a: QueueRow["payoutAccount"]) => (a ? `${a.accountLast4 ? `••${a.accountLast4}` : ""} ${a.upiVpa ?? ""}`.trim() : "No account");

const queueColumns = (onFail: (r: QueueRow) => void) => [
  { title: "Number", dataIndex: "number" },
  { title: "Organization", dataIndex: "organizationName" },
  { title: "Net", dataIndex: "net", align: "right" as const, render: (v: number) => <strong>{formatRupees(Number(v))}</strong> },
  { title: "Status", dataIndex: "status", render: (v: string) => <SettlementStatusTag status={v} /> },
  { title: "Account", render: (_: unknown, r: QueueRow) => accountLabel(r.payoutAccount) },
  { title: "Created", dataIndex: "createdAt", render: (v: string) => dayjs(v).format("D MMM YYYY") },
  { title: "", render: (_: unknown, r: QueueRow) => r.status === "APPROVED" && <Button size="small" danger onClick={() => onFail(r)}>Mark failed</Button> },
];

function QueueActions({ q, onPay }: { q: ReturnType<typeof useQueue>; onPay: () => void }) {
  const none = !q.selected.length;
  const downloadBankFile = async () => {
    try {
      const res = await axiosInstance.get("/ledger/platform/settlements/bank-export.csv", { params: { ids: q.selected.join(",") }, responseType: "blob" });
      saveBlob(res.data, `payouts-${dayjs().format("YYYY-MM-DD")}.csv`);
    } catch (err) {
      q.notification.error({ message: errorMessage(err, "Could not build the bank file") });
    }
  };
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Select style={{ width: 220 }} options={STATUS_OPTIONS} value={q.status} onChange={q.setStatus} />
      {q.status === "DRAFT" ? (
        <Button type="primary" icon={<CheckOutlined />} disabled={none} onClick={() => q.run(() => postSettlements("/approve", { ids: q.selected }), "Approved")}>Approve</Button>
      ) : (
        <>
          <Button icon={<DownloadOutlined />} disabled={none} onClick={downloadBankFile}>Download bank file</Button>
          <Button type="primary" icon={<DollarOutlined />} disabled={none} onClick={onPay}>Mark paid</Button>
        </>
      )}
    </Space>
  );
}

export function QueueTab() {
  const q = useQueue();
  const [paying, setPaying] = useState(false);
  const [failing, setFailing] = useState<QueueRow | null>(null);

  return (
    <>
      <QueueActions q={q} onPay={() => setPaying(true)} />
      <Table size="small" rowKey="id" loading={q.loading} dataSource={q.rows} columns={queueColumns(setFailing)} pagination={{ pageSize: 25 }} scroll={{ x: 900 }}
        rowSelection={{ selectedRowKeys: q.selected, onChange: (keys) => q.setSelected(keys as string[]) }} />
      {paying && (
        <MarkPaidModal count={q.selected.length} onCancel={() => setPaying(false)}
          onSubmit={async (v) => { await q.run(() => postSettlements("/mark-paid", { ids: q.selected, ...v }), "Marked paid"); setPaying(false); }} />
      )}
      {failing && (
        <MarkFailedModal number={failing.number} onCancel={() => setFailing(null)}
          onSubmit={async (reason) => { await q.run(() => postSettlements(`/${failing.id}/fail`, { reason }), "Marked failed"); setFailing(null); }} />
      )}
    </>
  );
}
