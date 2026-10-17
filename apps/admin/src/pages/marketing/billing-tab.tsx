import { useEffect, useState } from "react";
import { App, Button, Card, Form, Table, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { BillingFields, billingInitialValues } from "./billing-form";
import type { BillingProfile, BillingValues } from "./types";
import { errorMessage, invoiceHref } from "./utils";

interface Invoice {
  id: string;
  number: string | null;
  product: { name: string; kind: string };
  quantity: number;
  total: number;
  status: string;
  paidAt: string | null;
  invoiceUrl: string | null;
}

interface BillingTabProps {
  profile: BillingProfile | null;
  canEdit: boolean;
  onSaved: (p: BillingProfile) => void;
}

function BillingCard({ profile, canEdit, onSaved }: BillingTabProps) {
  const { notification } = App.useApp();
  const [form] = Form.useForm<BillingValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => { form.setFieldsValue(billingInitialValues(profile)); }, [form, profile]);

  const save = async (values: BillingValues) => {
    setSaving(true);
    try {
      await axiosInstance.put("/marketing/billing-profile", values);
      onSaved({ ...values, gstin: values.gstin ?? null });
      notification.success({ message: "Billing details saved" });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save billing details") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Billing details" size="small" style={{ marginBottom: 16, maxWidth: 560 }}>
      <Form form={form} layout="vertical" disabled={!canEdit} onFinish={save}>
        <BillingFields />
        <Tooltip title={canEdit ? undefined : "Only the owner can buy"}>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!canEdit}>Save</Button>
        </Tooltip>
      </Form>
    </Card>
  );
}

function InvoicesCard() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/marketing/orders")
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load invoices") }))
      .finally(() => setLoading(false));
  }, [notification]);

  const columns = [
    { title: "Invoice", dataIndex: "number", render: (v: string | null) => v ?? "—" },
    { title: "Product", render: (_: unknown, r: Invoice) => `${r.product.name} × ${r.quantity}` },
    { title: "Total", dataIndex: "total", align: "right" as const, render: formatRupees },
    { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={v === "PAID" ? "green" : "orange"}>{v}</Tag> },
    { title: "Paid", dataIndex: "paidAt", render: (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—") },
    { title: "", dataIndex: "invoiceUrl", render: (v: string | null) => (v ? <a href={invoiceHref(v)} target="_blank" rel="noreferrer">Invoice</a> : null) },
  ];
  return (
    <Card title="Invoices" size="small">
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 10 }} />
    </Card>
  );
}

export function BillingTab(props: BillingTabProps) {
  return (
    <>
      <BillingCard {...props} />
      <InvoicesCard />
    </>
  );
}
