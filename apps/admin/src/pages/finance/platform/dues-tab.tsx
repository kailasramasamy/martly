import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Modal, Popconfirm, Space, Table, Tag } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../../providers/data-provider";
import { errorMessage, formatRupees } from "../utils";

interface Due {
  id: string;
  organizationName: string;
  amount: number;
  status: string;
  paidAt: string | null;
  offlineReference: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = { PENDING: "gold", PAID: "green", CANCELLED: "default" };
const day = (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—");

function useDues() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Due[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/ledger/platform/dues");
      setRows(res.data.data);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load dues") });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => { void load(); }, [load]);

  const act = async (url: string, body: object | undefined, done: string) => {
    try {
      await axiosInstance.post(`/ledger/platform/dues/${url}`, body);
      notification.success({ message: done });
      await load();
    } catch (err) {
      notification.error({ message: errorMessage(err, "That didn't go through") });
    }
  };
  return { rows, loading, act };
}

const dueColumns = (onPay: (d: Due) => void, onCancel: (d: Due) => void) => [
  { title: "Organization", dataIndex: "organizationName" },
  { title: "Amount", dataIndex: "amount", align: "right" as const, render: (v: number) => formatRupees(Number(v)) },
  { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.charAt(0) + v.slice(1).toLowerCase()}</Tag> },
  { title: "Raised", dataIndex: "createdAt", render: day },
  { title: "Paid", dataIndex: "paidAt", render: day },
  { title: "Reference", render: (_: unknown, r: Due) => r.offlineReference ?? r.razorpayPaymentId ?? "\u2014" },
  {
    title: "",
    render: (_: unknown, r: Due) => r.status === "PENDING" && (
      <Space>
        <Button size="small" onClick={() => onPay(r)}>Mark paid (reference)</Button>
        <Popconfirm title="Cancel this due?" onConfirm={() => onCancel(r)}><Button size="small" danger>Cancel</Button></Popconfirm>
      </Space>
    ),
  },
];

export function DuesTab() {
  const { rows, loading, act } = useDues();
  const [paying, setPaying] = useState<Due | null>(null);
  const [reference, setReference] = useState("");

  const markPaid = async () => {
    if (!paying) return;
    await act(`${paying.id}/mark-paid`, { reference: reference.trim() }, "Due marked paid");
    setPaying(null);
    setReference("");
  };

  return (
    <>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={dueColumns(setPaying, (d) => act(`${d.id}/cancel`, undefined, "Due cancelled"))} pagination={{ pageSize: 25 }} scroll={{ x: 900 }} />
      <Modal open={!!paying} title="Mark due paid" okText="Mark paid" okButtonProps={{ disabled: reference.trim().length < 4 }} onCancel={() => setPaying(null)} onOk={markPaid}>
        <Input placeholder="Bank reference / UTR" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Modal>
    </>
  );
}
