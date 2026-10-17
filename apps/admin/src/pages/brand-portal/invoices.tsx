import { useEffect, useState } from "react";
import { App, Table, Tag } from "antd";
import { List } from "@refinedev/antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { errorMessage, invoiceHref } from "../marketing/utils";

interface BrandInvoice {
  id: string;
  number: string | null;
  product: string;
  campaign: { id: string; title: string } | null;
  quantity: number;
  total: number;
  status: string;
  paidAt: string | null;
  invoiceUrl: string | null;
}

const columns = [
  { title: "Invoice", dataIndex: "number", render: (v: string | null) => v ?? "—" },
  { title: "Campaign", render: (_: unknown, r: BrandInvoice) => r.campaign?.title ?? "—" },
  { title: "Package", render: (_: unknown, r: BrandInvoice) => `${r.product} × ${r.quantity}` },
  { title: "Total", dataIndex: "total", align: "right" as const, render: formatRupees },
  { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={v === "PAID" ? "green" : "orange"}>{v}</Tag> },
  { title: "Paid", dataIndex: "paidAt", render: (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—") },
  { title: "", dataIndex: "invoiceUrl", render: (v: string | null) => (v ? <a href={invoiceHref(v)} target="_blank" rel="noreferrer">Invoice</a> : null) },
];

export const BrandInvoices = () => {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<BrandInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/brand-portal/orders")
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load invoices") }))
      .finally(() => setLoading(false));
  }, [notification]);

  return (
    <List title="Invoices">
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 20 }} />
    </List>
  );
};
