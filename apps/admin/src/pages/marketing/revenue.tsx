import { useCallback, useEffect, useState } from "react";
import { App, Card, Col, Row, Select, Space, Statistic, Table, Tabs, Tag } from "antd";
import { DollarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { AdProductKindLabels } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { formatRupees } from "../promos/promo-utils";
import { errorMessage, invoiceHref } from "./utils";

const PAGE_SIZE = 25;
const STATUS_COLORS: Record<string, string> = { PAID: "green", PENDING: "gold", FAILED: "red", CANCELLED: "default", REFUNDED: "orange" };
const statusOptions = Object.keys(STATUS_COLORS).map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }));
const kindOptions = Object.entries(AdProductKindLabels).map(([value, label]) => ({ value, label }));

interface Totals { orders: number; total: number; net: number }

interface OrderRow {
  id: string;
  number: string | null;
  status: string;
  quantity: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paidAt: string | null;
  createdAt: string;
  offlineReference: string | null;
  razorpayPaymentId: string | null;
  invoiceUrl: string | null;
  product: { name: string; kind: string };
  organization: { name: string } | null;
  brand: { name: string } | null;
}

interface OrdersMeta { total: number; revenue: { allTime: Totals; thisMonth: Totals } }

interface Subscriber {
  id: string;
  name: string;
  plan: { name: string; code: string } | null;
  currentUntil: string | null;
  paidThrough: string | null;
}

const date = (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—");

function useOrders() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<OrdersMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [kind, setKind] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/marketing-admin/orders", { params: { page, pageSize: PAGE_SIZE, status, kind } });
      setRows(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load orders") });
    } finally {
      setLoading(false);
    }
  }, [page, status, kind, notification]);

  useEffect(() => { void load(); }, [load]);
  return { rows, meta, page, setPage, status, setStatus, kind, setKind, loading };
}

function OrdersTab() {
  const { rows, meta, page, setPage, status, setStatus, kind, setKind, loading } = useOrders();
  const filter = (set: (v: string | undefined) => void) => (v?: string) => { set(v); setPage(1); };
  const columns = [
    { title: "Invoice", dataIndex: "number", render: (v: string | null) => v ?? "—" },
    { title: "Buyer", render: (_: unknown, r: OrderRow) => r.organization?.name ?? r.brand?.name ?? "—" },
    { title: "Product", render: (_: unknown, r: OrderRow) => `${r.product.name} × ${r.quantity}` },
    { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: "Subtotal", dataIndex: "subtotal", align: "right" as const, render: formatRupees },
    { title: "GST", align: "right" as const, render: (_: unknown, r: OrderRow) => formatRupees(r.cgst + r.sgst + r.igst) },
    { title: "Total", dataIndex: "total", align: "right" as const, render: formatRupees },
    { title: "Paid", dataIndex: "paidAt", render: date },
    {
      title: "Via",
      render: (_: unknown, r: OrderRow) => (r.offlineReference ? `Bank ${r.offlineReference}` : r.razorpayPaymentId ? "Razorpay" : "—"),
    },
    {
      title: "",
      dataIndex: "invoiceUrl",
      render: (v: string | null) => (v ? <a href={invoiceHref(v)} target="_blank" rel="noreferrer">Invoice</a> : null),
    },
  ];
  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Net revenue this month" value={meta?.revenue.thisMonth.net ?? 0} formatter={(v) => formatRupees(Number(v))} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Net revenue all time" value={meta?.revenue.allTime.net ?? 0} formatter={(v) => formatRupees(Number(v))} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Paid orders" value={meta?.revenue.allTime.orders ?? 0} /></Card></Col>
      </Row>
      <Space style={{ marginBottom: 16 }}>
        <Select allowClear placeholder="Status" options={statusOptions} value={status} onChange={filter(setStatus)} style={{ width: 160 }} />
        <Select allowClear placeholder="Product" options={kindOptions} value={kind} onChange={filter(setKind)} style={{ width: 220 }} />
      </Space>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: meta?.total ?? 0, showSizeChanger: false, onChange: setPage }}
      />
    </>
  );
}

function SubscribersTab() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/marketing-admin/subscribers")
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load store plans") }))
      .finally(() => setLoading(false));
  }, [notification]);

  const columns = [
    { title: "Organization", dataIndex: "name" },
    { title: "Plan", dataIndex: "plan", render: (p: Subscriber["plan"]) => (p ? <Tag color="teal">{p.name}</Tag> : <Tag>Free</Tag>) },
    { title: "Current period ends", dataIndex: "currentUntil", render: date },
    { title: "Paid through", dataIndex: "paidThrough", render: date },
  ];
  return <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: PAGE_SIZE }} />;
}

export const MarketingRevenue = () => (
  <>
    <h2 style={{ marginTop: 0 }}>{sectionTitle(<DollarOutlined />, "Marketing revenue")}</h2>
    <Tabs
      items={[
        { key: "orders", label: "Orders", children: <OrdersTab /> },
        { key: "plans", label: "Store plans", children: <SubscribersTab /> },
      ]}
    />
  </>
);
